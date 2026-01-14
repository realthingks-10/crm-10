import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { UserNameUtils } from '@/utils/userNameUtils';

interface Meeting {
  id: string;
  subject: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  join_url?: string | null;
  attendees?: unknown;
  lead_id?: string | null;
  contact_id?: string | null;
  created_by?: string | null;
  status: string;
  outcome?: string | null;
  notes?: string | null;
}

export const useMeetingsImportExport = (onImportComplete: () => void) => {
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleImport = async (file: File) => {
    setIsImporting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('CSV file must have headers and at least one data row');
      }

      // Parse headers
      const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
      console.log('CSV Headers:', headers);

      // Required fields mapping
      const subjectIdx = headers.findIndex(h => h === 'subject' || h === 'title' || h === 'meeting subject');
      const startDateIdx = headers.findIndex(h => h === 'start date' || h === 'start_time' || h === 'date');
      const startTimeIdx = headers.findIndex(h => h === 'start time' || h === 'time');
      const endDateIdx = headers.findIndex(h => h === 'end date');
      const endTimeIdx = headers.findIndex(h => h === 'end_time' || h === 'end time');
      const statusIdx = headers.findIndex(h => h === 'status');
      const descriptionIdx = headers.findIndex(h => h === 'description' || h === 'agenda');
      const outcomeIdx = headers.findIndex(h => h === 'outcome');
      const notesIdx = headers.findIndex(h => h === 'notes');
      const joinUrlIdx = headers.findIndex(h => h === 'join_url' || h === 'meeting link' || h === 'join url');
      const createdByIdx = headers.findIndex(h => h === 'created_by' || h === 'created by' || h === 'host');

      if (subjectIdx === -1) {
        throw new Error('CSV must have a "Subject" column');
      }
      if (startDateIdx === -1) {
        throw new Error('CSV must have a "Start Date" or "start_time" column');
      }

      // Collect user names for lookup
      const userNames: string[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (createdByIdx !== -1 && values[createdByIdx]) {
          userNames.push(values[createdByIdx]);
        }
      }
      const userIdMap = await UserNameUtils.fetchUserIdsByNames(userNames);

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        try {
          const values = parseCSVLine(lines[i]);
          const subject = values[subjectIdx]?.trim();
          
          if (!subject) {
            errors.push(`Row ${i + 1}: Missing subject`);
            errorCount++;
            continue;
          }

          // Parse dates
          let startTime: Date;
          let endTime: Date;

          const dateValue = values[startDateIdx]?.trim();
          const timeValue = startTimeIdx !== -1 ? values[startTimeIdx]?.trim() : '';
          const endDateValue = endDateIdx !== -1 ? values[endDateIdx]?.trim() : '';
          const endTimeValue = endTimeIdx !== -1 ? values[endTimeIdx]?.trim() : '';

          // Try to parse start time - support multiple formats
          startTime = parseDateTimeFromCSV(dateValue, timeValue);

          if (isNaN(startTime.getTime())) {
            errors.push(`Row ${i + 1}: Invalid start date/time`);
            errorCount++;
            continue;
          }

          // Parse end time or default to 1 hour later
          if (endTimeValue || endDateValue) {
            const endDateBase = endDateValue || dateValue;
            endTime = parseDateTimeFromCSV(endDateBase, endTimeValue);
          } else {
            endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour later
          }

          if (isNaN(endTime.getTime())) {
            endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
          }

          // Resolve user ID from name or UUID
          let createdBy = user.id;
          if (createdByIdx !== -1 && values[createdByIdx]) {
            createdBy = UserNameUtils.resolveUserId(values[createdByIdx], userIdMap, user.id);
          }

          const meetingData = {
            subject,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            status: statusIdx !== -1 ? (values[statusIdx]?.trim() || 'scheduled') : 'scheduled',
            description: descriptionIdx !== -1 ? values[descriptionIdx]?.trim() || null : null,
            outcome: outcomeIdx !== -1 ? values[outcomeIdx]?.trim() || null : null,
            notes: notesIdx !== -1 ? values[notesIdx]?.trim() || null : null,
            join_url: joinUrlIdx !== -1 ? values[joinUrlIdx]?.trim() || null : null,
            created_by: createdBy,
          };

          const { error } = await supabase.from('meetings').insert(meetingData);
          
          if (error) {
            errors.push(`Row ${i + 1}: ${error.message}`);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (rowError: any) {
          errors.push(`Row ${i + 1}: ${rowError.message}`);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: "Import Successful",
          description: `Imported ${successCount} meetings${errorCount > 0 ? ` with ${errorCount} errors` : ''}`,
        });
      }

      if (errorCount > 0 && errors.length > 0) {
        console.error('Import errors:', errors);
        toast({
          title: "Import Errors",
          description: `${errorCount} errors occurred. Check console for details.`,
          variant: "destructive",
        });
      }

      onImportComplete();

    } catch (error: any) {
      console.error('Import failed:', error);
      toast({
        title: "Import Failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleExport = async (meetings: Meeting[]) => {
    setIsExporting(true);
    
    try {
      if (!meetings || meetings.length === 0) {
        toast({
          title: "No Data",
          description: "No meetings to export.",
        });
        return;
      }

      // Collect user IDs for display names
      const userIds: string[] = [];
      meetings.forEach(meeting => {
        if (meeting.created_by) userIds.push(meeting.created_by);
      });
      const userNameMap = await UserNameUtils.fetchUserDisplayNames(userIds);

      // CSV headers with user-friendly format - Added deal_id, account_id
      const headers = [
        'ID',
        'Subject',
        'Start Date',
        'Start Time',
        'End Date',
        'End Time',
        'Status',
        'Outcome',
        'Description',
        'Notes',
        'Join URL',
        'Lead ID',
        'Contact ID',
        'Deal ID',
        'Account ID',
        'Created By',
        'Created At',
        'Updated At'
      ];

      // Build CSV rows with formatted values
      const rows = meetings.map(meeting => {
        const createdByName = meeting.created_by ? (userNameMap[meeting.created_by] || '') : '';
        
        return [
          meeting.id,
          escapeCSVField(meeting.subject),
          UserNameUtils.formatDateForExport(meeting.start_time),
          UserNameUtils.formatTimeForExport(meeting.start_time),
          UserNameUtils.formatDateForExport(meeting.end_time),
          UserNameUtils.formatTimeForExport(meeting.end_time),
          meeting.status,
          meeting.outcome || '',
          escapeCSVField(meeting.description || ''),
          escapeCSVField(meeting.notes || ''),
          meeting.join_url || '',
          meeting.lead_id || '',
          meeting.contact_id || '',
          (meeting as any).deal_id || '',
          (meeting as any).account_id || '',
          createdByName,
          UserNameUtils.formatDateTimeForExport((meeting as any).created_at),
          UserNameUtils.formatDateTimeForExport((meeting as any).updated_at)
        ].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');

      // Download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('href', url);
      a.setAttribute('download', `meetings_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: `Exported ${meetings.length} meetings to CSV.`,
      });

    } catch (error: any) {
      console.error('Export failed:', error);
      toast({
        title: "Export Failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return {
    handleImport,
    handleExport,
    isImporting,
    isExporting,
    fileInputRef,
    triggerFileInput,
  };
};

// Helper function to parse date and time from CSV values
function parseDateTimeFromCSV(dateValue: string, timeValue?: string): Date {
  if (!dateValue) return new Date(NaN);
  
  // If dateValue already contains time (ISO or full datetime)
  if (dateValue.includes('T') || (dateValue.includes(' ') && dateValue.includes(':'))) {
    return new Date(dateValue);
  }

  // Try parsing different date formats
  let parsedDate: Date | null = null;

  // YYYY-MM-DD format
  const yyyymmddMatch = dateValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (yyyymmddMatch) {
    const [, year, month, day] = yyyymmddMatch;
    parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // DD/MM/YYYY format
  const ddmmyyyySlash = dateValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!parsedDate && ddmmyyyySlash) {
    const [, day, month, year] = ddmmyyyySlash;
    parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // DD-MM-YYYY format
  const ddmmyyyyDash = dateValue.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!parsedDate && ddmmyyyyDash) {
    const [, day, month, year] = ddmmyyyyDash;
    parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Generic fallback
  if (!parsedDate || isNaN(parsedDate.getTime())) {
    parsedDate = new Date(dateValue);
  }

  // Apply time if provided
  if (parsedDate && !isNaN(parsedDate.getTime()) && timeValue) {
    const timeMatch = timeValue.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (timeMatch) {
      const [, hours, minutes, seconds] = timeMatch;
      parsedDate.setHours(parseInt(hours), parseInt(minutes), parseInt(seconds || '0'), 0);
    }
  } else if (parsedDate && !isNaN(parsedDate.getTime()) && !timeValue) {
    // Default to 9:00 AM if no time provided
    parsedDate.setHours(9, 0, 0, 0);
  }

  return parsedDate || new Date(NaN);
}

// Helper function to parse CSV line (handles quoted fields)
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// Helper function to escape CSV fields
function escapeCSVField(field: string): string {
  if (!field) return '';
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
