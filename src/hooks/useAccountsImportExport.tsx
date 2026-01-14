import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { UserNameUtils } from '@/utils/userNameUtils';

const validStatuses = ['New', 'Working', 'Warm', 'Hot', 'Nurture', 'Closed-Won', 'Closed-Lost'];
const validTags = [
  'AUTOSAR', 'Adaptive AUTOSAR', 'Embedded Systems', 'BSW', 'ECU', 'Zone Controller',
  'HCP', 'CI/CD', 'V&V Testing', 'Integration', 'Software Architecture', 'LINUX',
  'QNX', 'Cybersecurity', 'FuSa', 'OTA', 'Diagnostics', 'Vehicle Network',
  'Vehicle Architecture', 'Connected Car', 'Platform', 'µC/HW'
];

export const useAccountsImportExport = (onImportComplete: () => void) => {
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

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

      const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
      
      // Collect all user names from the CSV to fetch their IDs
      const userNames: string[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        headers.forEach((header, idx) => {
          if ((header === 'account_owner' || header === 'created_by' || header === 'modified_by') && values[idx]) {
            userNames.push(values[idx]);
          }
        });
      }

      // Fetch user IDs by names
      const userIdMap = await UserNameUtils.fetchUserIdsByNames(userNames);
      
      const records: any[] = [];
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const record: any = {};
        
        headers.forEach((header, idx) => {
          record[header] = values[idx] || null;
        });

        // Map common header variations
        const companyName = record.company_name || record.name || record.company;
        if (!companyName) {
          errors.push(`Row ${i + 1}: Missing company_name`);
          continue;
        }

        // Validate status
        let status = record.status || 'New';
        if (!validStatuses.includes(status)) {
          status = 'New';
        }

        // Parse tags
        let tags: string[] = [];
        if (record.tags) {
          const tagList = record.tags.split(/[,;]/).map((t: string) => t.trim());
          tags = tagList.filter((t: string) => validTags.includes(t));
        }

        // UUID validation regex
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        // Check if record has a valid UUID for update (ignore non-UUID id values)
        const existingId = record.id && uuidRegex.test(record.id) ? record.id : null;

        records.push({
          id: existingId,
          company_name: companyName,
          email: record.email || null,
          region: record.region || null,
          country: record.country || null,
          website: record.website || null,
          company_type: record.company_type || null,
          tags: tags.length > 0 ? tags : null,
          status,
          notes: record.notes || null,
          industry: record.industry || null,
          phone: record.phone || null,
          // For updates, preserve original created_by; for inserts, use current user (RLS requirement)
          original_created_by: UserNameUtils.resolveUserId(record.created_by, userIdMap, user.id),
          account_owner: UserNameUtils.resolveUserId(record.account_owner, userIdMap, user.id),
          modified_by: user.id,
        });
      }

      if (records.length === 0) {
        throw new Error('No valid records found in CSV');
      }

      // Upsert by id or company_name
      let successCount = 0;
      let updateCount = 0;
      const insertErrors: string[] = [];

      for (const record of records) {
        const { id, original_created_by, ...recordWithoutId } = record;

        // If id is provided, try to update by id first
        if (id) {
          const { data: existingById } = await supabase
            .from('accounts')
            .select('id')
            .eq('id', id)
            .maybeSingle();

          if (existingById) {
            const { error: updateError } = await supabase
              .from('accounts')
              .update({ ...recordWithoutId, created_by: original_created_by, updated_at: new Date().toISOString() })
              .eq('id', id);
            
            if (updateError) {
              insertErrors.push(`Update failed for "${record.company_name}": ${updateError.message}`);
            } else {
              updateCount++;
            }
            continue;
          }
        }

        // Otherwise, check by company_name
        const { data: existing } = await supabase
          .from('accounts')
          .select('id')
          .eq('company_name', record.company_name)
          .maybeSingle();

        if (existing) {
          const { error: updateError } = await supabase
            .from('accounts')
            .update({ ...recordWithoutId, created_by: original_created_by, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
          
          if (updateError) {
            insertErrors.push(`Update failed for "${record.company_name}": ${updateError.message}`);
          } else {
            updateCount++;
          }
        } else {
          // For new inserts, MUST use current user as created_by (RLS requirement)
          const insertData = {
            ...recordWithoutId,
            created_by: user.id, // RLS requires created_by = auth.uid()
          };
          
          const { error: insertError } = await supabase
            .from('accounts')
            .insert(insertData);
          
          if (insertError) {
            insertErrors.push(`Insert failed for "${record.company_name}": ${insertError.message}`);
          } else {
            successCount++;
          }
        }
      }

      // Combine row-level errors with insert/update errors
      const allErrors = [...errors, ...insertErrors];
      
      if (allErrors.length > 0) {
        console.error('Import errors:', allErrors);
      }

      const successMessage = `Created ${successCount} new accounts, updated ${updateCount} existing accounts`;
      const errorMessage = allErrors.length > 0 ? `. ${allErrors.length} rows failed.` : '';

      toast({
        title: allErrors.length > 0 ? "Import Completed with Errors" : "Import Successful",
        description: successMessage + errorMessage,
        variant: allErrors.length > 0 ? "destructive" : "default",
      });

      onImportComplete();
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleExport = async () => {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        toast({
          title: "No Data",
          description: "No accounts to export.",
        });
        return;
      }

      // Collect all user IDs to fetch display names
      const userIds: string[] = [];
      data.forEach(account => {
        if (account.account_owner) userIds.push(account.account_owner);
        if (account.created_by) userIds.push(account.created_by);
        if (account.modified_by) userIds.push(account.modified_by);
      });

      const userNameMap = await UserNameUtils.fetchUserDisplayNames(userIds);

      // Fetch linked data counts for each account
      const accountIds = data.map(a => a.id);
      
      // Fetch tasks count per account
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('account_id')
        .in('account_id', accountIds);
      
      const tasksCounts: Record<string, number> = {};
      tasksData?.forEach(task => {
        if (task.account_id) {
          tasksCounts[task.account_id] = (tasksCounts[task.account_id] || 0) + 1;
        }
      });

      // Fetch leads count per account
      const { data: leadsData } = await supabase
        .from('leads')
        .select('account_id')
        .in('account_id', accountIds);
      
      const leadsCounts: Record<string, number> = {};
      leadsData?.forEach(lead => {
        if (lead.account_id) {
          leadsCounts[lead.account_id] = (leadsCounts[lead.account_id] || 0) + 1;
        }
      });

      const headers = [
        'ID', 'Company Name', 'Email', 'Phone', 'Company Type', 'Industry', 
        'Tags', 'Country', 'Region', 'Status', 'Website', 'Notes',
        'Last Activity Date', 'Linked Contacts', 'Linked Deals', 'Linked Leads', 'Tasks Count',
        'Account Owner', 'Created By', 'Modified By', 'Created At', 'Updated At'
      ];

      const csvLines = [headers.join(',')];

      for (const account of data) {
        const row = [
          account.id || '',
          escapeCSVField(account.company_name || ''),
          escapeCSVField(account.email || ''),
          escapeCSVField(account.phone || ''),
          escapeCSVField(account.company_type || ''),
          escapeCSVField(account.industry || ''),
          account.tags ? account.tags.join(';') : '',
          escapeCSVField(account.country || ''),
          escapeCSVField(account.region || ''),
          escapeCSVField(account.status || ''),
          escapeCSVField(account.website || ''),
          escapeCSVField(account.notes || ''),
          account.last_activity_date ? format(new Date(account.last_activity_date), 'yyyy-MM-dd') : '',
          account.contact_count || 0,
          account.deal_count || 0,
          leadsCounts[account.id] || 0,
          tasksCounts[account.id] || 0,
          account.account_owner ? (userNameMap[account.account_owner] || '') : '',
          account.created_by ? (userNameMap[account.created_by] || '') : '',
          account.modified_by ? (userNameMap[account.modified_by] || '') : '',
          account.created_at ? format(new Date(account.created_at), 'yyyy-MM-dd HH:mm:ss') : '',
          account.updated_at ? format(new Date(account.updated_at), 'yyyy-MM-dd HH:mm:ss') : '',
        ];
        csvLines.push(row.join(','));
      }

      const csvContent = csvLines.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('href', url);
      a.setAttribute('download', `accounts_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: `Exported ${data.length} accounts to CSV.`,
      });
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  return {
    handleImport,
    handleExport,
    isImporting
  };
};

// Helper function to escape CSV fields
function escapeCSVField(field: string): string {
  if (!field) return '';
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
