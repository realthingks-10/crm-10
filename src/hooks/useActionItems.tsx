import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type ActionItemPriority = 'Low' | 'Medium' | 'High';
export type ActionItemStatus = 'Open' | 'In Progress' | 'Completed' | 'Cancelled';
export type ModuleType = 'accounts' | 'contacts' | 'deals';

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
        query = query
          .is('archived_at', null)
          .neq('status', 'Completed');
      } else {
        query = query.or('status.eq.Completed,archived_at.not.is.null');
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ActionItem[];
    },
    enabled: !!user,
  });

  // Helper: get all matching query keys for optimistic updates
  const getActionItemsQueryKeys = () => {
    return queryClient.getQueryCache()
      .findAll({ queryKey: ['action_items'] })
      .map(q => q.queryKey as readonly unknown[]);
  };

  // Create action item — with optimistic updates
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
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['action_items'] });

      const tempId = `temp-${Date.now()}`;
      const optimisticItem: ActionItem = {
        id: tempId,
        module_type: input.module_type,
        module_id: input.module_id ?? null,
        title: input.title,
        description: input.description ?? null,
        assigned_to: input.assigned_to ?? null,
        due_date: input.due_date ?? null,
        due_time: input.due_time ?? null,
        priority: input.priority ?? 'Medium',
        status: input.status ?? 'Open',
        created_by: user!.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const queryKeys = getActionItemsQueryKeys();
      const previousSnapshots: { queryKey: readonly unknown[]; data: unknown }[] = [];

      for (const queryKey of queryKeys) {
        const data = queryClient.getQueryData(queryKey);
        previousSnapshots.push({ queryKey, data });

        queryClient.setQueryData(queryKey, (old: ActionItem[] | undefined) => {
          if (!old) return [optimisticItem];
          return [optimisticItem, ...old];
        });
      }

      return { previousSnapshots, tempId };
    },
    onError: (error, _input, context) => {
      console.error('Error creating action item:', error);
      toast.error('Failed to create action item');
      if (context?.previousSnapshots) {
        for (const { queryKey, data } of context.previousSnapshots) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSuccess: () => {
      toast.success('Action item created successfully');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['action_items'] });
    },
  });

  // Update action item — with optimistic updates
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
    onMutate: async (updatedItem) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['action_items'] });

      // Snapshot all action_items caches
      const queryKeys = getActionItemsQueryKeys();
      const previousSnapshots: { queryKey: readonly unknown[]; data: unknown }[] = [];

      for (const queryKey of queryKeys) {
        const data = queryClient.getQueryData(queryKey);
        previousSnapshots.push({ queryKey, data });

        // Optimistically update the cache
        queryClient.setQueryData(queryKey, (old: ActionItem[] | undefined) => {
          if (!old) return old;
          return old.map(item =>
            item.id === updatedItem.id
              ? { ...item, ...updatedItem, updated_at: new Date().toISOString() }
              : item
          );
        });
      }

      return { previousSnapshots };
    },
    onError: (error: any, _updatedItem, context) => {
      console.error('Error updating action item:', error);
      const message = error?.message || error?.details || 'Failed to update action item';
      toast.error(message);
      // Rollback all caches
      if (context?.previousSnapshots) {
        for (const { queryKey, data } of context.previousSnapshots) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSuccess: () => {
      toast.success('Action item updated successfully');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['action_items'] });
    },
  });

  // Delete action item — with optimistic updates
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('action_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: ['action_items'] });

      const queryKeys = getActionItemsQueryKeys();
      const previousSnapshots: { queryKey: readonly unknown[]; data: unknown }[] = [];

      for (const queryKey of queryKeys) {
        const data = queryClient.getQueryData(queryKey);
        previousSnapshots.push({ queryKey, data });

        queryClient.setQueryData(queryKey, (old: ActionItem[] | undefined) => {
          if (!old) return old;
          return old.filter(item => item.id !== deletedId);
        });
      }

      return { previousSnapshots };
    },
    onError: (error, _deletedId, context) => {
      console.error('Error deleting action item:', error);
      toast.error('Failed to delete action item');
      if (context?.previousSnapshots) {
        for (const { queryKey, data } of context.previousSnapshots) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSuccess: () => {
      toast.success('Action item deleted successfully');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['action_items'] });
    },
  });

  // Bulk update status — with optimistic updates
  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: ActionItemStatus }) => {
      const { error } = await supabase
        .from('action_items')
        .update({ status })
        .in('id', ids);

      if (error) throw error;
    },
    onMutate: async ({ ids, status }) => {
      await queryClient.cancelQueries({ queryKey: ['action_items'] });

      const queryKeys = getActionItemsQueryKeys();
      const previousSnapshots: { queryKey: readonly unknown[]; data: unknown }[] = [];

      for (const queryKey of queryKeys) {
        const data = queryClient.getQueryData(queryKey);
        previousSnapshots.push({ queryKey, data });

        queryClient.setQueryData(queryKey, (old: ActionItem[] | undefined) => {
          if (!old) return old;
          const idSet = new Set(ids);
          return old.map(item =>
            idSet.has(item.id)
              ? { ...item, status, updated_at: new Date().toISOString() }
              : item
          );
        });
      }

      return { previousSnapshots };
    },
    onError: (error, _vars, context) => {
      console.error('Error updating action items:', error);
      toast.error('Failed to update action items');
      if (context?.previousSnapshots) {
        for (const { queryKey, data } of context.previousSnapshots) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSuccess: () => {
      toast.success('Action items updated successfully');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['action_items'] });
    },
  });

  // Bulk delete — with optimistic updates
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('action_items')
        .delete()
        .in('id', ids);

      if (error) throw error;
    },
    onMutate: async (deletedIds) => {
      await queryClient.cancelQueries({ queryKey: ['action_items'] });

      const queryKeys = getActionItemsQueryKeys();
      const previousSnapshots: { queryKey: readonly unknown[]; data: unknown }[] = [];

      for (const queryKey of queryKeys) {
        const data = queryClient.getQueryData(queryKey);
        previousSnapshots.push({ queryKey, data });

        queryClient.setQueryData(queryKey, (old: ActionItem[] | undefined) => {
          if (!old) return old;
          const idSet = new Set(deletedIds);
          return old.filter(item => !idSet.has(item.id));
        });
      }

      return { previousSnapshots };
    },
    onError: (error, _ids, context) => {
      console.error('Error deleting action items:', error);
      toast.error('Failed to delete action items');
      if (context?.previousSnapshots) {
        for (const { queryKey, data } of context.previousSnapshots) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSuccess: () => {
      toast.success('Action items deleted successfully');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['action_items'] });
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
          queryClient.invalidateQueries({ queryKey: ['action_items'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return {
    actionItems,
    isLoading,
    error,
    filters,
    setFilters,
    updateFilter: (key: keyof ActionItemFilters, value: string | boolean) => {
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
