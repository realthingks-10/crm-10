
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SecurityEvent {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: any;
  ip_address?: string;
  created_at: string;
}

export const useSecurityAudit = () => {
  const { toast } = useToast();

  const logSecurityEvent = async (
    action: string,
    resourceType: string,
    resourceId?: string,
    details?: any
  ) => {
    try {
      // First check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No authenticated user, skipping security event logging');
        return;
      }

      const { error } = await supabase.rpc('log_security_event', {
        p_action: action,
        p_resource_type: resourceType,
        p_resource_id: resourceId,
        p_details: details
      });

      if (error) {
        console.error('Failed to log security event:', error);
      } else {
        console.log('Security event logged successfully:', { action, resourceType, resourceId });
      }
    } catch (error) {
      console.error('Security audit logging error:', error);
    }
  };

  const logDataAccess = async (
    tableName: string,
    operation: string,
    recordId?: string
  ) => {
    try {
      // First check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No authenticated user, skipping data access logging');
        return;
      }

      const { error } = await supabase.rpc('log_data_access', {
        p_table_name: tableName,
        p_operation: operation,
        p_record_id: recordId
      });

      if (error) {
        console.error('Failed to log data access:', error);
      } else {
        console.log('Data access logged successfully:', { tableName, operation, recordId });
      }
    } catch (error) {
      console.error('Data access logging error:', error);
    }
  };

  return {
    logSecurityEvent,
    logDataAccess
  };
};
