import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const defaultColumnWidths: Record<string, number> = {
  checkbox: 48,
  lead_name: 200,
  company_name: 180,
  position: 120,
  email: 180,
  phone_no: 120,
  country: 100,
  contact_owner: 130,
  lead_status: 100,
  industry: 120,
  contact_source: 100,
  actions: 80,
};

export function useLeadColumnWidths() {
  const { user } = useAuth();
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(defaultColumnWidths);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) { 
      setIsLoading(false); 
      return; 
    }
    
    const loadPreferences = async () => {
      try {
        const { data } = await supabase
          .from('column_preferences')
          .select('column_widths')
          .eq('user_id', user.id)
          .eq('module', 'leads_widths')
          .maybeSingle();
        
        if (data?.column_widths) {
          setColumnWidths({ ...defaultColumnWidths, ...(data.column_widths as Record<string, number>) });
        }
      } catch (error) {
        console.error('Error loading lead column widths:', error);
      } finally { 
        setIsLoading(false); 
      }
    };
    loadPreferences();
  }, [user]);

  const updateColumnWidth = useCallback(async (field: string, width: number) => {
    const newWidths = { ...columnWidths, [field]: width };
    setColumnWidths(newWidths);
    
    if (!user) return;
    
    try {
      await supabase.from('column_preferences').upsert({
        user_id: user.id,
        module: 'leads_widths',
        column_widths: newWidths,
      }, { onConflict: 'user_id,module' });
    } catch (error) {
      console.error('Error saving lead column widths:', error);
    }
  }, [user, columnWidths]);

  return { columnWidths, isLoading, updateColumnWidth, defaultColumnWidths };
}
