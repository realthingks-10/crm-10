import { useCallback } from 'react';
import { useSecurityAudit } from '@/hooks/useSecurityAudit';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export const useSecureDataAccess = () => {
  const { logDataAccess, logSecurityEvent } = useSecurityAudit();
  const { toast } = useToast();
  const { user } = useAuth();

  const secureQuery = useCallback(async (
    tableName: string,
    query: any,
    operation: string = 'SELECT'
  ) => {
    try {
      // Non-blocking: fire and forget for logging - don't wait
      void logDataAccess(tableName, operation);

      const result = await query;

      if (result.error) {
        // Non-blocking: log failed access attempts
        void logSecurityEvent('DATA_ACCESS_FAILED', tableName, undefined, {
          error: result.error.message,
          operation
        });
        throw result.error;
      }

      // Non-blocking: log sensitive data access
      if (['deals', 'contacts', 'leads'].includes(tableName.toLowerCase())) {
        void logSecurityEvent('SENSITIVE_DATA_ACCESS', tableName, undefined, {
          operation,
          record_count: result.data?.length || 1
        });
      }

      return result;
    } catch (error) {
      console.error(`Secure ${operation} failed for ${tableName}:`, error);
      throw error;
    }
  }, [logDataAccess, logSecurityEvent]);

  const secureExport = useCallback(async (
    tableName: string,
    data: any[],
    exportType: string = 'CSV'
  ) => {
    try {
      // Non-blocking: log export attempt
      void logSecurityEvent('DATA_EXPORT', tableName, undefined, {
        export_type: exportType,
        record_count: data.length,
        timestamp: new Date().toISOString()
      });

      // Check if user is authenticated using cached auth
      if (!user) {
        throw new Error('User not authenticated for export');
      }

      return data;
    } catch (error) {
      console.error(`Secure export failed for ${tableName}:`, error);
      toast({
        title: "Export Failed",
        description: "You don't have permission to export this data",
        variant: "destructive",
      });
      throw error;
    }
  }, [logSecurityEvent, toast, user]);

  return {
    secureQuery,
    secureExport
  };
};
