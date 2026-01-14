import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

// User name conversion utilities for import/export

export class UserNameUtils {
  
  // Fetch display names for a list of user IDs
  static async fetchUserDisplayNames(userIds: string[]): Promise<Record<string, string>> {
    const uniqueIds = [...new Set(userIds.filter(id => id && id.trim()))];
    if (uniqueIds.length === 0) return {};

    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', uniqueIds);

      const nameMap: Record<string, string> = {};
      profiles?.forEach(profile => {
        nameMap[profile.id] = profile.full_name || 'Unknown User';
      });

      return nameMap;
    } catch (error) {
      console.warn('UserNameUtils: Error fetching display names:', error);
      return {};
    }
  }

  // Fetch user IDs by display names
  static async fetchUserIdsByNames(names: string[]): Promise<Record<string, string>> {
    const uniqueNames = [...new Set(names.filter(name => name && name.trim()))];
    if (uniqueNames.length === 0) return {};

    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name');

      const idMap: Record<string, string> = {};
      profiles?.forEach(profile => {
        if (profile.full_name) {
          idMap[profile.full_name.toLowerCase()] = profile.id;
        }
      });

      return idMap;
    } catch (error) {
      console.warn('UserNameUtils: Error fetching user IDs:', error);
      return {};
    }
  }

  // Resolve user ID from name or UUID
  static resolveUserId(value: string | null, userIdMap: Record<string, string>, defaultId: string): string {
    if (!value || !value.trim()) return defaultId;
    
    // Check if it's already a UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(value)) return value;
    
    // Otherwise, look up by name
    return userIdMap[value.toLowerCase()] || defaultId;
  }

  // Format ID for export (keep full UUID for proper import matching)
  static formatIdForExport(id: string | null): string {
    if (!id) return '';
    return id; // Keep full UUID for import/export roundtrip
  }

  // Format date/datetime for export (ISO standard format)
  static formatDateTimeForExport(dateValue: any): string {
    if (!dateValue) return '';
    
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return '';
      return format(date, 'yyyy-MM-dd HH:mm:ss');
    } catch {
      return '';
    }
  }

  // Format date for export (ISO standard format)
  static formatDateForExport(dateValue: any): string {
    if (!dateValue) return '';
    
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return '';
      return format(date, 'yyyy-MM-dd');
    } catch {
      return '';
    }
  }

  // Format time for export (HH:mm format)
  static formatTimeForExport(dateValue: any): string {
    if (!dateValue) return '';
    
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return '';
      return format(date, 'HH:mm');
    } catch {
      return '';
    }
  }

  // User fields that should be converted
  static readonly USER_FIELDS = [
    'account_owner', 'contact_owner', 'created_by', 'modified_by', 
    'assigned_to', 'lead_owner', 'host', 'organizer'
  ];
  
  // Date/time fields that should be formatted
  static readonly DATETIME_FIELDS = [
    'created_at', 'modified_at', 'created_time', 'modified_time', 
    'updated_at', 'completed_at', 'last_contacted_at'
  ];

  // Check if field is a user field
  static isUserField(fieldName: string): boolean {
    return this.USER_FIELDS.includes(fieldName);
  }

  // Check if field is a datetime field
  static isDateTimeField(fieldName: string): boolean {
    return this.DATETIME_FIELDS.includes(fieldName);
  }

  // Extract all user IDs from data for a specific set of fields
  static extractUserIds(data: any[], fields: string[] = this.USER_FIELDS): string[] {
    const userIds: string[] = [];
    data.forEach(record => {
      fields.forEach(field => {
        if (record[field]) {
          userIds.push(record[field]);
        }
      });
    });
    return userIds;
  }

  // Extract all user names from CSV rows for specific headers
  static extractUserNames(rows: string[][], headers: string[], fields: string[] = this.USER_FIELDS): string[] {
    const names: string[] = [];
    rows.forEach(row => {
      headers.forEach((header, idx) => {
        if (fields.includes(header) && row[idx]) {
          names.push(row[idx]);
        }
      });
    });
    return names;
  }
}
