
import { useCallback } from 'react';
import { useSecurityAudit } from '@/hooks/useSecurityAudit';

export const useCRUDAudit = () => {
  const { logSecurityEvent } = useSecurityAudit();

  const logCreate = useCallback(async (
    tableName: string,
    recordId: string,
    recordData?: any
  ) => {
    await logSecurityEvent('CREATE', tableName, recordId, {
      operation: 'INSERT',
      status: 'Success',
      timestamp: new Date().toISOString(),
      record_data: recordData,
      module: tableName.charAt(0).toUpperCase() + tableName.slice(1)
    });
  }, [logSecurityEvent]);

  const logUpdate = useCallback(async (
    tableName: string,
    recordId: string,
    updatedFields?: any,
    oldData?: any
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
      module: tableName.charAt(0).toUpperCase() + tableName.slice(1)
    });
  }, [logSecurityEvent]);

  const logDelete = useCallback(async (
    tableName: string,
    recordId?: string,
    deletedData?: any,
    bulkCount?: number,
    status: string = 'Success'
  ) => {
    const action = status === 'Success' ? 'DELETE' : 'Unauthorized Delete Attempt';
    
    await logSecurityEvent(action, tableName, recordId, {
      operation: 'DELETE',
      status: status,
      timestamp: new Date().toISOString(),
      deleted_data: deletedData,
      bulk_count: bulkCount,
      module: tableName.charAt(0).toUpperCase() + tableName.slice(1)
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
      sample_records: records?.slice(0, 3) // Log first 3 as sample
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
      update_data: updateData
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
      record_ids: recordIds?.slice(0, 10) // Log first 10 IDs
    });
  }, [logSecurityEvent]);

  return {
    logCreate,
    logUpdate,
    logDelete,
    logBulkCreate,
    logBulkUpdate,
    logBulkDelete
  };
};
