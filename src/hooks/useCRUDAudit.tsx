import { useCallback } from 'react';
import { useSecurityAudit } from '@/hooks/useSecurityAudit';

export const useCRUDAudit = () => {
  const { logSecurityEvent } = useSecurityAudit();

  const logCreate = useCallback(async (
    tableName: string,
    recordId: string,
    recordData?: any,
    recordName?: string
  ) => {
    await logSecurityEvent('CREATE', tableName, recordId, {
      operation: 'INSERT',
      status: 'Success',
      timestamp: new Date().toISOString(),
      record_data: recordData,
      record_name: recordName,
      module: formatModuleName(tableName)
    });
  }, [logSecurityEvent]);

  const logUpdate = useCallback(async (
    tableName: string,
    recordId: string,
    updatedFields?: any,
    oldData?: any,
    recordName?: string
  ) => {
    // Calculate field changes (old → new)
    const fieldChanges: Record<string, { old: any; new: any }> = {};
    
    if (updatedFields && oldData) {
      Object.keys(updatedFields).forEach(key => {
        if (updatedFields[key] !== oldData[key]) {
          fieldChanges[key] = {
            old: oldData[key],
            new: updatedFields[key]
          };
        }
      });
    }

    await logSecurityEvent('UPDATE', tableName, recordId, {
      operation: 'UPDATE',
      status: 'Success',
      timestamp: new Date().toISOString(),
      updated_fields: updatedFields,
      old_data: oldData,
      field_changes: fieldChanges,
      record_name: recordName,
      module: formatModuleName(tableName)
    });
  }, [logSecurityEvent]);

  const logDelete = useCallback(async (
    tableName: string,
    recordId?: string,
    deletedData?: any,
    bulkCount?: number,
    status: string = 'Success',
    recordName?: string
  ) => {
    const action = status === 'Success' ? 'DELETE' : 'Unauthorized Delete Attempt';
    
    await logSecurityEvent(action, tableName, recordId, {
      operation: 'DELETE',
      status: status,
      timestamp: new Date().toISOString(),
      deleted_data: deletedData,
      bulk_count: bulkCount,
      record_name: recordName,
      module: formatModuleName(tableName)
    });
  }, [logSecurityEvent]);

  const logBulkCreate = useCallback(async (
    tableName: string,
    recordCount: number,
    records?: any[]
  ) => {
    await logSecurityEvent('BULK_CREATE', tableName, undefined, {
      operation: 'BULK_INSERT',
      status: 'Success',
      timestamp: new Date().toISOString(),
      record_count: recordCount,
      sample_records: records?.slice(0, 3),
      module: formatModuleName(tableName)
    });
  }, [logSecurityEvent]);

  const logBulkUpdate = useCallback(async (
    tableName: string,
    recordCount: number,
    updateData?: any
  ) => {
    await logSecurityEvent('BULK_UPDATE', tableName, undefined, {
      operation: 'BULK_UPDATE',
      status: 'Success',
      timestamp: new Date().toISOString(),
      record_count: recordCount,
      update_data: updateData,
      module: formatModuleName(tableName)
    });
  }, [logSecurityEvent]);

  const logBulkDelete = useCallback(async (
    tableName: string,
    recordCount: number,
    recordIds?: string[]
  ) => {
    await logSecurityEvent('BULK_DELETE', tableName, undefined, {
      operation: 'BULK_DELETE',
      status: 'Success',
      timestamp: new Date().toISOString(),
      record_count: recordCount,
      record_ids: recordIds?.slice(0, 10),
      module: formatModuleName(tableName)
    });
  }, [logSecurityEvent]);

  // Settings change logging
  const logSettingsChange = useCallback(async (
    settingsType: string,
    changes?: any,
    oldSettings?: any
  ) => {
    const fieldChanges: Record<string, { old: any; new: any }> = {};
    
    if (changes && oldSettings) {
      Object.keys(changes).forEach(key => {
        if (changes[key] !== oldSettings[key]) {
          fieldChanges[key] = {
            old: oldSettings[key],
            new: changes[key]
          };
        }
      });
    }

    await logSecurityEvent('SETTINGS_UPDATE', settingsType, undefined, {
      operation: 'SETTINGS_UPDATE',
      status: 'Success',
      timestamp: new Date().toISOString(),
      changes: changes,
      old_settings: oldSettings,
      field_changes: fieldChanges,
      module: formatModuleName(settingsType)
    });
  }, [logSecurityEvent]);

  // Data export logging
  const logDataExport = useCallback(async (
    tableName: string,
    recordCount: number,
    exportFormat: string = 'CSV'
  ) => {
    await logSecurityEvent('DATA_EXPORT', tableName, undefined, {
      operation: 'EXPORT',
      status: 'Success',
      timestamp: new Date().toISOString(),
      record_count: recordCount,
      export_format: exportFormat,
      module: formatModuleName(tableName)
    });
  }, [logSecurityEvent]);

  // Data import logging
  const logDataImport = useCallback(async (
    tableName: string,
    recordCount: number,
    successCount: number,
    errorCount: number
  ) => {
    await logSecurityEvent('DATA_IMPORT', tableName, undefined, {
      operation: 'IMPORT',
      status: errorCount === 0 ? 'Success' : 'Partial',
      timestamp: new Date().toISOString(),
      total_records: recordCount,
      success_count: successCount,
      error_count: errorCount,
      module: formatModuleName(tableName)
    });
  }, [logSecurityEvent]);

  return {
    logCreate,
    logUpdate,
    logDelete,
    logBulkCreate,
    logBulkUpdate,
    logBulkDelete,
    logSettingsChange,
    logDataExport,
    logDataImport
  };
};

// Helper to format module names consistently
const formatModuleName = (tableName: string): string => {
  const moduleMap: Record<string, string> = {
    'contacts': 'Contacts',
    'leads': 'Leads',
    'deals': 'Deals',
    'accounts': 'Accounts',
    'tasks': 'Tasks',
    'meetings': 'Meetings',
    'branding': 'Branding Settings',
    'branding_settings': 'Branding Settings',
    'announcements': 'Announcements',
    'email_templates': 'Email Templates',
    'notification_preferences': 'Notification Settings',
    'user_preferences': 'User Preferences',
    'page_permissions': 'Page Access',
  };
  
  return moduleMap[tableName] || tableName.charAt(0).toUpperCase() + tableName.slice(1).replace(/_/g, ' ');
};