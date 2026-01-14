
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCRUDAudit } from '@/hooks/useCRUDAudit';

export const useLeadDeletion = () => {
  const { toast } = useToast();
  const { logBulkDelete } = useCRUDAudit();
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteSingleLead = async (leadId: string, deleteLinkedRecords: boolean = true) => {
    return deleteLeads([leadId], deleteLinkedRecords);
  };

  const deleteLeads = async (leadIds: string[], deleteLinkedRecords: boolean = true) => {
    if (leadIds.length === 0) return { success: false, message: 'No leads selected' };

    setIsDeleting(true);
    
    try {
      console.log('Starting delete process for leads:', leadIds);
      
      if (deleteLinkedRecords) {
        console.log('Cleaning up related records...');
        
        // Clean up notifications that reference these leads directly
        const { error: notificationLeadError } = await supabase
          .from('notifications')
          .delete()
          .in('lead_id', leadIds);
          
        if (notificationLeadError) {
          console.error('Error deleting notifications for leads:', notificationLeadError);
          // Don't throw - continue with deletion
        }

        // Clean up tasks linked to these leads (optional - tasks can exist without parent)
        // We don't delete tasks, just unlink them by setting lead_id to null
        const { error: tasksUnlinkError } = await supabase
          .from('tasks')
          .update({ lead_id: null })
          .in('lead_id', leadIds);
        
        if (tasksUnlinkError) {
          console.error('Error unlinking tasks from leads:', tasksUnlinkError);
          // Don't throw - continue with deletion
        }
      }

      // Delete the leads - this should now work without foreign key constraints
      console.log('Deleting leads...');
      const { error: leadsDeleteError } = await supabase
        .from('leads')
        .delete()
        .in('id', leadIds);

      if (leadsDeleteError) {
        console.error('Error deleting leads:', leadsDeleteError);
        
        // Check if this is a permission error (RLS policy violation)
        if (leadsDeleteError.message?.includes('row-level security') || 
            leadsDeleteError.message?.includes('permission') ||
            leadsDeleteError.code === 'PGRST301' || 
            leadsDeleteError.code === '42501') {
          
          // Log unauthorized attempt for each lead
          try {
            const { data: { user } } = await supabase.auth.getUser();
            for (const leadId of leadIds) {
              await supabase.from('security_audit_log').insert({
                user_id: user?.id,
                action: 'Unauthorized Delete Attempt',
                resource_type: 'leads',
                resource_id: leadId,
                details: {
                  operation: 'DELETE',
                  status: 'Blocked',
                  timestamp: new Date().toISOString(),
                  module: 'Leads',
                  reason: 'Insufficient permissions'
                }
              });
            }
          } catch (logError) {
            console.error('Failed to log unauthorized attempt:', logError);
          }

          toast({
            title: "Permission Denied",
            description: "You don't have permission to delete this record.",
            variant: "destructive",
          });
          
          return { success: false, message: "You don't have permission to delete this record." };
        }
        
        throw leadsDeleteError;
      }

      // Log the successful deletion
      await logBulkDelete('leads', leadIds.length, leadIds);

      console.log('Delete operation completed successfully');
      
      const successMessage = leadIds.length === 1 
        ? 'Lead deleted successfully'
        : `${leadIds.length} leads deleted successfully`;
      
      toast({
        title: "Success",
        description: successMessage,
      });
      
      return { success: true, message: successMessage };
    } catch (error: any) {
      console.error('Delete operation failed:', error);
      
      let errorMessage = "Failed to delete leads";
      if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      return { success: false, message: errorMessage };
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    deleteLeads,
    deleteSingleLead,
    isDeleting
  };
};
