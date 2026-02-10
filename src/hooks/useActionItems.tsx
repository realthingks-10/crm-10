import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type ActionItemPriority = 'Low' | 'Medium' | 'High';
export type ActionItemStatus = 'Open' | 'In Progress' | 'Completed' | 'Cancelled';
export type ModuleType = 'deals' | 'leads' | 'contacts';

export interface ActionItem {
  id: string;
  module_type: ModuleType;
  module_id: string | null;
  title: string;
  description: string | null;
  assigned_to: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: ActionItemPriority;
  status: ActionItemStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ActionItemFilters {
  module_type: ModuleType | 'all';
  priority: ActionItemPriority | 'all';
  status: ActionItemStatus | 'all';
  assigned_to: string | 'all';
  search: string;
  showArchived: boolean;
}

export interface CreateActionItemInput {
  module_type: ModuleType;
  module_id?: string | null;
  title: string;
  description?: string | null;
  assigned_to?: string | null;
  due_date?: string | null;
  due_time?: string | null;
  priority?: ActionItemPriority;
  status?: ActionItemStatus;
}

export interface UpdateActionItemInput extends Partial<CreateActionItemInput> {
  id: string;
}

const defaultFilters: ActionItemFilters = {
  module_type: 'all',
  priority: 'all',
  status: 'all',
  assigned_to: 'all',
  search: '',
  showArchived: false,
};

export function useActionItems(initialFilters?: Partial<ActionItemFilters>) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ActionItemFilters>({
    ...defaultFilters,
    ...initialFilters,
  });

  // Fetch action items
  const {
    data: actionItems = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['action_items', filters],
    queryFn: async () => {
      let query = supabase
        .from('action_items')
        .select('*')
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(5000);

      if (filters.module_type !== 'all') {
        query = query.eq('module_type', filters.module_type);
      }
      if (filters.priority !== 'all') {
        query = query.eq('priority', filters.priority);
      }
      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters.assigned_to !== 'all') {
        query = query.eq('assigned_to', filters.assigned_to);
      }
      if (filters.search) {
        query = query.ilike('title', `%${filters.search}%`);
      }
      
      // Filter by archived/completed status
      if (!filters.showArchived) {
        // Show non-completed, non-archived items
        query = query
          .is('archived_at', null)
          .neq('status', 'Completed');
      } else {
        // Show completed or archived items
        query = query.or('status.eq.Completed,archived_at.not.is.null');
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ActionItem[];
    },
    enabled: !!user,
  });

  // Create action item
  const createMutation = useMutation({
    mutationFn: async (input: CreateActionItemInput) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('action_items')
        .insert({
          ...input,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action_items'] });
      toast.success('Action item created successfully');
    },
    onError: (error) => {
      console.error('Error creating action item:', error);
      toast.error('Failed to create action item');
    },
  });

  // Update action item
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...input }: UpdateActionItemInput) => {
      const { data, error } = await supabase
        .from('action_items')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action_items'] });
      toast.success('Action item updated successfully');
    },
    onError: (error) => {
      console.error('Error updating action item:', error);
      toast.error('Failed to update action item');
    },
  });

  // Delete action item
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('action_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action_items'] });
      toast.success('Action item deleted successfully');
    },
    onError: (error) => {
      console.error('Error deleting action item:', error);
      toast.error('Failed to delete action item');
    },
  });

  // Bulk update status
  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: ActionItemStatus }) => {
      const { error } = await supabase
        .from('action_items')
        .update({ status })
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action_items'] });
      toast.success('Action items updated successfully');
    },
    onError: (error) => {
      console.error('Error updating action items:', error);
      toast.error('Failed to update action items');
    },
  });

  // Bulk delete
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('action_items')
        .delete()
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action_items'] });
      toast.success('Action items deleted successfully');
    },
    onError: (error) => {
      console.error('Error deleting action items:', error);
      toast.error('Failed to delete action items');
    },
  });

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('action_items_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'action_items' },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refetch]);

  return {
    actionItems,
    isLoading,
    error,
    filters,
    setFilters,
    updateFilter: (key: keyof ActionItemFilters, value: string | boolean) => {
      // Handle showArchived boolean conversion
      if (key === 'showArchived') {
        const boolValue = typeof value === 'boolean' ? value : value === 'true';
        setFilters((prev) => ({ ...prev, [key]: boolValue }));
      } else {
        setFilters((prev) => ({ ...prev, [key]: value as string }));
      }
    },
    resetFilters: () => setFilters(defaultFilters),
    createActionItem: createMutation.mutateAsync,
    updateActionItem: updateMutation.mutateAsync,
    deleteActionItem: deleteMutation.mutateAsync,
    bulkUpdateStatus: bulkUpdateStatusMutation.mutateAsync,
    bulkDelete: bulkDeleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
