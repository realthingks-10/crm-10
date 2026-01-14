import { format } from 'date-fns';

// Global date format configuration - DD/MM/YYYY
export const GLOBAL_DATE_FORMAT = 'dd/MM/yyyy';
export const GLOBAL_DATE_TIME_FORMAT = 'dd/MM/yyyy HH:mm';
export const GLOBAL_DATE_TIME_FULL_FORMAT = 'dd/MM/yyyy HH:mm:ss';
export const GLOBAL_SHORT_DATE_FORMAT = 'dd/MM';
export const GLOBAL_MONTH_YEAR_FORMAT = 'MMMM yyyy';

// Display utility - formats dates for UI display in DD/MM/YYYY
export const formatDisplayDate = (date: Date | string | null | undefined): string => {
  if (!date) return '-';
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return '-';
    return format(dateObj, GLOBAL_DATE_FORMAT);
  } catch {
    return '-';
  }
};

// Display utility - formats datetime for UI display in DD/MM/YYYY HH:mm
export const formatDisplayDateTime = (date: Date | string | null | undefined): string => {
  if (!date) return '-';
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return '-';
    return format(dateObj, GLOBAL_DATE_TIME_FORMAT);
  } catch {
    return '-';
  }
};

// Display utility - formats datetime with seconds for UI display
export const formatDisplayDateTimeFull = (date: Date | string | null | undefined): string => {
  if (!date) return '-';
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return '-';
    return format(dateObj, GLOBAL_DATE_TIME_FULL_FORMAT);
  } catch {
    return '-';
  }
};

// Display utility - short date format DD/MM
export const formatDisplayShortDate = (date: Date | string | null | undefined): string => {
  if (!date) return '-';
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return '-';
    return format(dateObj, GLOBAL_SHORT_DATE_FORMAT);
  } catch {
    return '-';
  }
};

// Centralized date conversion utilities for import/export

export class DateFormatUtils {
  
  // Convert date from any format to YYYY-MM-DD for export (Supabase standard)
  static formatDateForExport(dateValue: any): string {
    if (!dateValue) return '';
    
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return '';
      
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.warn('DateFormatUtils: Invalid date for export:', dateValue);
      return '';
    }
  }
  
  // Convert datetime from ISO format to YYYY-MM-DD HH:mm:ss for export
  static formatDateTimeForExport(dateValue: any): string {
    if (!dateValue) return '';
    
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return '';
      
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const seconds = date.getSeconds().toString().padStart(2, '0');
      
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch (error) {
      console.warn('DateFormatUtils: Invalid datetime for export:', dateValue);
      return '';
    }
  }
  
  // Convert date from multiple formats to YYYY-MM-DD for database import
  static convertDateForImport(dateValue: string): string | null {
    if (!dateValue || dateValue.trim() === '') return null;
    
    const trimmedValue = dateValue.trim();
    
    try {
      // Handle already correct YYYY-MM-DD format
      const yyyymmddMatch = trimmedValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (yyyymmddMatch) {
        const [, year, month, day] = yyyymmddMatch;
        const parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(parsedDate.getTime())) {
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }

      // Handle DD-MM-YYYY format
      const ddmmyyyyMatch = trimmedValue.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
      if (ddmmyyyyMatch) {
        const [, day, month, year] = ddmmyyyyMatch;
        const parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(parsedDate.getTime())) {
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }

      // Handle DD-MM-YY format (2-digit year)
      const ddmmyyMatch = trimmedValue.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/);
      if (ddmmyyMatch) {
        const [, day, month, shortYear] = ddmmyyMatch;
        const fullYear = parseInt(shortYear) > 50 ? 1900 + parseInt(shortYear) : 2000 + parseInt(shortYear);
        const parsedDate = new Date(fullYear, parseInt(month) - 1, parseInt(day));
        if (!isNaN(parsedDate.getTime())) {
          return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }

      // Handle DD-MM-YY HH:mm format (2-digit year with time)
      const ddmmyyTimeMatch = trimmedValue.match(/^(\d{1,2})-(\d{1,2})-(\d{2})\s+(\d{1,2}):(\d{2})$/);
      if (ddmmyyTimeMatch) {
        const [, day, month, shortYear, hours, minutes] = ddmmyyTimeMatch;
        const fullYear = parseInt(shortYear) > 50 ? 1900 + parseInt(shortYear) : 2000 + parseInt(shortYear);
        return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hours.padStart(2, '0')}:${minutes}:00`;
      }

      // Handle DD/MM/YYYY format (primary format)
      const ddmmyyyySlashMatch = trimmedValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (ddmmyyyySlashMatch) {
        const [, day, month, year] = ddmmyyyySlashMatch;
        const parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(parsedDate.getTime())) {
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }

      // Handle MM/DD/YYYY format (legacy support)
      const mmddyyyyMatch = trimmedValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (mmddyyyyMatch) {
        const [, month, day, year] = mmddyyyyMatch;
        const parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(parsedDate.getTime())) {
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }

      // Handle YYYY/MM/DD format
      const yyyymmddSlashMatch = trimmedValue.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
      if (yyyymmddSlashMatch) {
        const [, year, month, day] = yyyymmddSlashMatch;
        const parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(parsedDate.getTime())) {
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }

      // Handle DD.MM.YYYY format
      const ddmmyyyyDotMatch = trimmedValue.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (ddmmyyyyDotMatch) {
        const [, day, month, year] = ddmmyyyyDotMatch;
        const parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(parsedDate.getTime())) {
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }

      // Handle DD-MM-YYYY HH:mm:ss format
      const ddmmyyyyTimeMatch = trimmedValue.match(/^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
      if (ddmmyyyyTimeMatch) {
        const [, day, month, year, hours, minutes, seconds] = ddmmyyyyTimeMatch;
        const parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes), parseInt(seconds));
        if (!isNaN(parsedDate.getTime())) {
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
        }
      }

      // Handle ISO datetime format (preserve as is if valid)
      if (trimmedValue.includes('T') || (trimmedValue.includes(' ') && trimmedValue.includes(':'))) {
        const date = new Date(trimmedValue);
        if (!isNaN(date.getTime())) {
          return trimmedValue;
        }
      }
      
      // Try generic Date parsing as last resort
      const genericDate = new Date(trimmedValue);
      if (!isNaN(genericDate.getTime())) {
        const year = genericDate.getFullYear();
        const month = (genericDate.getMonth() + 1).toString().padStart(2, '0');
        const day = genericDate.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch (error) {
      console.warn(`DateFormatUtils: Error parsing date: ${trimmedValue}`, error);
    }
    
    console.warn(`DateFormatUtils: Invalid date format: ${trimmedValue}. Please use DD/MM/YYYY format.`);
    return null;
  }
  
  // Get field type for proper conversion
  static getFieldType(fieldName: string): 'date' | 'datetime' | 'other' {
    const dateFields = [
      'expected_closing_date', 'start_date', 'end_date', 
      'signed_contract_date', 'implementation_start_date', 
      'rfq_received_date', 'proposal_due_date'
    ];
    
    const datetimeFields = [
      'created_at', 'modified_at', 'created_time', 'modified_time'
    ];
    
    if (dateFields.includes(fieldName)) return 'date';
    if (datetimeFields.includes(fieldName)) return 'datetime';
    return 'other';
  }
  
  // Process field for export based on its type - always use YYYY-MM-DD for dates
  static processFieldForExport(fieldName: string, value: any): string {
    const fieldType = this.getFieldType(fieldName);
    
    switch (fieldType) {
      case 'date':
        return this.formatDateForExport(value);
      case 'datetime':
        return this.formatDateTimeForExport(value);
      default:
        return value !== undefined && value !== null ? String(value) : '';
    }
  }
  
  // Process field for import based on its type - convert to YYYY-MM-DD
  static processFieldForImport(fieldName: string, value: string): string | null {
    const fieldType = this.getFieldType(fieldName);
    
    if (fieldType === 'date' || fieldType === 'datetime') {
      return this.convertDateForImport(value);
    }
    
    return value && value.trim() !== '' ? value.trim() : null;
  }

  // Validate if a date string is in correct YYYY-MM-DD format
  static isValidDateFormat(dateValue: string): boolean {
    if (!dateValue || dateValue.trim() === '') return true; // Empty is valid (optional field)
    
    const trimmedValue = dateValue.trim();
    const yyyymmddMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    
    if (!yyyymmddMatch) return false;
    
    const [, year, month, day] = yyyymmddMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    return !isNaN(date.getTime()) && 
           date.getFullYear() === parseInt(year) &&
           date.getMonth() === parseInt(month) - 1 &&
           date.getDate() === parseInt(day);
  }
}
