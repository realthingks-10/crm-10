
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSecureDataAccess } from '@/hooks/useSecureDataAccess';
import { useToast } from '@/hooks/use-toast';
import { useCRUDAudit } from '@/hooks/useCRUDAudit';
import { fetchAllRecords } from '@/utils/supabasePagination';

interface Lead {
  id: string;
  lead_name: string;
  company_name?: string;
  email?: string;
  phone_no?: string;
  position?: string;
  created_by?: string;
  contact_owner?: string;
  lead_status?: string;
  created_time?: string;
  modified_time?: string;
  linkedin?: string;
  website?: string;
  contact_source?: string;
  industry?: string;
  country?: string;
  description?: string;
}

export const useSecureLeads = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const { secureQuery, secureExport } = useSecureDataAccess();
  const { logDelete } = useCRUDAudit();
  const { toast } = useToast();

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const allLeads = await fetchAllRecords<Lead>('leads', 'created_time', false);
      setLeads(allLeads);
    } catch (error: any) {
      console.error('Error fetching leads:', error);
      toast({
        title: "Error",
        description: "Failed to fetch leads",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteLead = async (id: string) => {
    try {
      // First get the lead to check ownership and get data for logging
      const leadToDelete = leads.find(l => l.id === id);
      if (!leadToDelete) {
        throw new Error('Lead not found');
      }

      const query = supabase
        .from('leads')
        .delete()
        .eq('id', id)
        .select()
        .single();

      const result = await secureQuery('leads', query, 'DELETE');
      
      // If we get here, the deletion was successful
      setLeads(prev => prev.filter(lead => lead.id !== id));
      
      // Log successful deletion
      await logDelete('leads', id, leadToDelete);
      
      toast({
        title: "Success",
        description: "Lead deleted successfully",
      });
    } catch (error: any) {
      console.error('Error deleting lead:', error);
      
      // Check if this is a permission error (RLS policy violation)
      if (error.message?.includes('row-level security') || 
          error.message?.includes('permission') ||
          error.code === 'PGRST301' || 
          error.code === '42501') {
        
        // Log unauthorized attempt
        try {
          const { data: { user } } = await supabase.auth.getUser();
          await supabase.from('security_audit_log').insert({
            user_id: user?.id,
            action: 'Unauthorized Delete Attempt',
            resource_type: 'leads',
            resource_id: id,
            details: {
              operation: 'DELETE',
              status: 'Blocked',
              timestamp: new Date().toISOString(),
              module: 'Leads',
              reason: 'Insufficient permissions'
            }
          });
        } catch (logError) {
          console.error('Failed to log unauthorized attempt:', logError);
        }

        toast({
          title: "Permission Denied",
          description: "You don't have permission to delete this record.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to delete lead",
          variant: "destructive",
        });
      }
      throw error;
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  return {
    leads,
    loading,
    fetchLeads,
    deleteLead
  };
};
