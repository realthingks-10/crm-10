import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export interface ColumnConfig {
  field: string;
  label: string;
  visible: boolean;
  order: number;
}

type ModuleName = 'accounts' | 'leads' | 'contacts' | 'deals' | 'meetings';

interface UseColumnPreferencesOptions {
  moduleName: ModuleName;
  defaultColumns: ColumnConfig[];
}

export const useColumnPreferences = ({ moduleName, defaultColumns }: UseColumnPreferencesOptions) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Use useAuth instead of supabase.auth.getUser() - eliminates extra network call
  const { user } = useAuth();
  const userId = user?.id || null;

  // Fetch column preferences from database
  const { data: savedColumns, isLoading } = useQuery({
    queryKey: ['column-preferences', moduleName, userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from('table_column_preferences')
        .select('column_config')
        .eq('user_id', userId)
        .eq('module_name', moduleName)
        .maybeSingle();

      if (error) {
        console.error('Error fetching column preferences:', error);
        return null;
      }

      return data?.column_config as unknown as ColumnConfig[] | null;
    },
    enabled: !!userId,
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (columns: ColumnConfig[]) => {
      if (!userId) throw new Error('User not authenticated');

      // First try to update existing record
      const { data: existing } = await supabase
        .from('table_column_preferences')
        .select('id')
        .eq('user_id', userId)
        .eq('module_name', moduleName)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('table_column_preferences')
          .update({
            column_config: JSON.parse(JSON.stringify(columns)),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new - cast the entire object to bypass strict typing
        const insertData = {
          user_id: userId,
          module_name: moduleName,
          column_config: JSON.parse(JSON.stringify(columns)),
        };
        
        const { error } = await supabase
          .from('table_column_preferences')
          .insert(insertData as any);

        if (error) throw error;
      }

      return columns;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['column-preferences', moduleName, userId] });
      toast({
        title: 'Preferences saved',
        description: 'Column preferences saved successfully',
      });
    },
    onError: (error) => {
      console.error('Error saving column preferences:', error);
      toast({
        title: 'Error',
        description: 'Failed to save column preferences',
        variant: 'destructive',
      });
    },
  });

  // Use saved columns if available, otherwise use defaults
  // Filter out any columns that no longer exist in defaultColumns and add any new ones
  const columns = (() => {
    if (!savedColumns) return defaultColumns;
    
    const validFields = new Set(defaultColumns.map(dc => dc.field));
    
    // Filter saved columns to only include valid fields
    const validSavedColumns = savedColumns.filter(sc => validFields.has(sc.field));
    
    // Add any new fields from defaultColumns that aren't in saved
    const savedFields = new Set(validSavedColumns.map(sc => sc.field));
    const missingColumns = defaultColumns.filter(dc => !savedFields.has(dc.field));
    
    return [...validSavedColumns, ...missingColumns];
  })();

  return {
    columns,
    isLoading,
    saveColumns: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    defaultColumns,
  };
};
