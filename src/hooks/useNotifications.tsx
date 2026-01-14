import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { startOfDay, subDays } from 'date-fns';

interface Notification {
  id: string;
  user_id: string;
  lead_id: string | null;
  message: string;
  status: 'read' | 'unread';
  notification_type: string;
  action_item_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationFilters {
  searchTerm: string;
  statusFilter: 'all' | 'read' | 'unread';
  typeFilter: string;
  dateFilter: 'all' | 'today' | '7days' | '30days';
}

export const useNotifications = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [filters, setFilters] = useState<NotificationFilters>({
    searchTerm: '',
    statusFilter: 'all',
    typeFilter: 'all',
    dateFilter: 'all',
  });
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Fetch notifications with React Query
  const { data: notificationsData, isLoading: loading } = useQuery({
    queryKey: ['notifications', user?.id, currentPage, itemsPerPage, filters],
    queryFn: async () => {
      if (!user) return { notifications: [], total: 0, unreadCount: 0 };

      // Build query with filters
      let query = supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id);

      // Apply status filter
      if (filters.statusFilter !== 'all') {
        query = query.eq('status', filters.statusFilter);
      }

      // Apply type filter
      if (filters.typeFilter !== 'all') {
        query = query.eq('notification_type', filters.typeFilter);
      }

      // Apply date filter
      if (filters.dateFilter !== 'all') {
        const now = new Date();
        let startDate: Date;
        
        switch (filters.dateFilter) {
          case 'today':
            startDate = startOfDay(now);
            break;
          case '7days':
            startDate = subDays(now, 7);
            break;
          case '30days':
            startDate = subDays(now, 30);
            break;
          default:
            startDate = new Date(0);
        }
        
        query = query.gte('created_at', startDate.toISOString());
      }

      // Apply search filter (client-side filtering for message content)
      // Note: For better performance with large datasets, consider full-text search

      // Get count first
      const { count, error: countError } = await query;
      if (countError) throw countError;

      // Get paginated notifications
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage - 1;
      
      let dataQuery = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(startIndex, endIndex);

      // Re-apply filters for data query
      if (filters.statusFilter !== 'all') {
        dataQuery = dataQuery.eq('status', filters.statusFilter);
      }
      if (filters.typeFilter !== 'all') {
        dataQuery = dataQuery.eq('notification_type', filters.typeFilter);
      }
      if (filters.dateFilter !== 'all') {
        const now = new Date();
        let startDate: Date;
        switch (filters.dateFilter) {
          case 'today':
            startDate = startOfDay(now);
            break;
          case '7days':
            startDate = subDays(now, 7);
            break;
          case '30days':
            startDate = subDays(now, 30);
            break;
          default:
            startDate = new Date(0);
        }
        dataQuery = dataQuery.gte('created_at', startDate.toISOString());
      }

      const { data, error } = await dataQuery;
      if (error) throw error;

      // Get total unread count (unfiltered)
      const { data: unreadData, error: unreadError } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'unread');
      
      if (unreadError) throw unreadError;

      let typedNotifications: Notification[] = (data || []).map(item => ({
        ...item,
        status: item.status as 'read' | 'unread'
      }));

      // Apply client-side search filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        typedNotifications = typedNotifications.filter(n =>
          n.message.toLowerCase().includes(searchLower)
        );
      }

      return {
        notifications: typedNotifications,
        total: count || 0,
        unreadCount: unreadData?.length || 0
      };
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const notifications = notificationsData?.notifications || [];
  const totalNotifications = notificationsData?.total || 0;
  const unreadCount = notificationsData?.unreadCount || 0;

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('notifications')
        .update({ status: 'read' })
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;
      return notificationId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
    onError: (error) => {
      console.error('Error marking notification as read:', error);
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('notifications')
        .update({ status: 'read' })
        .eq('user_id', user.id)
        .eq('status', 'unread');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      toast({
        title: "Success",
        description: "All notifications marked as read"
      });
    },
    onError: (error) => {
      console.error('Error marking all notifications as read:', error);
      toast({
        title: "Error",
        description: "Failed to mark notifications as read",
        variant: "destructive"
      });
    },
  });

  // Bulk mark as read mutation
  const bulkMarkAsReadMutation = useMutation({
    mutationFn: async (notificationIds: string[]) => {
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('notifications')
        .update({ status: 'read' })
        .in('id', notificationIds)
        .eq('user_id', user.id);

      if (error) throw error;
      return notificationIds;
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      toast({
        title: "Success",
        description: `${ids.length} notification(s) marked as read`
      });
    },
    onError: (error) => {
      console.error('Error bulk marking notifications as read:', error);
      toast({
        title: "Error",
        description: "Failed to mark notifications as read",
        variant: "destructive"
      });
    },
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;
      return notificationId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      toast({
        title: "Success",
        description: "Notification deleted"
      });
    },
    onError: (error) => {
      console.error('Error deleting notification:', error);
      toast({
        title: "Error",
        description: "Failed to delete notification",
        variant: "destructive"
      });
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (notificationIds: string[]) => {
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('notifications')
        .delete()
        .in('id', notificationIds)
        .eq('user_id', user.id);

      if (error) throw error;
      return notificationIds;
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      toast({
        title: "Success",
        description: `${ids.length} notification(s) deleted`
      });
    },
    onError: (error) => {
      console.error('Error bulk deleting notifications:', error);
      toast({
        title: "Error",
        description: "Failed to delete notifications",
        variant: "destructive"
      });
    },
  });

  // Clear all read notifications mutation
  const clearAllReadMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id)
        .eq('status', 'read');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      toast({
        title: "Success",
        description: "All read notifications cleared"
      });
    },
    onError: (error) => {
      console.error('Error clearing read notifications:', error);
      toast({
        title: "Error",
        description: "Failed to clear read notifications",
        variant: "destructive"
      });
    },
  });

  // Wrapper functions
  const markAsRead = useCallback(async (notificationId: string) => {
    await markAsReadMutation.mutateAsync(notificationId);
  }, [markAsReadMutation]);

  const markAllAsRead = useCallback(async () => {
    await markAllAsReadMutation.mutateAsync();
  }, [markAllAsReadMutation]);

  const bulkMarkAsRead = useCallback(async (notificationIds: string[]) => {
    await bulkMarkAsReadMutation.mutateAsync(notificationIds);
  }, [bulkMarkAsReadMutation]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    await deleteNotificationMutation.mutateAsync(notificationId);
  }, [deleteNotificationMutation]);

  const bulkDelete = useCallback(async (notificationIds: string[]) => {
    await bulkDeleteMutation.mutateAsync(notificationIds);
  }, [bulkDeleteMutation]);

  const clearAllRead = useCallback(async () => {
    await clearAllReadMutation.mutateAsync();
  }, [clearAllReadMutation]);

  const fetchNotifications = useCallback(async (page: number = 1) => {
    setCurrentPage(page);
  }, []);

  const updateFilters = useCallback((newFilters: Partial<NotificationFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      searchTerm: '',
      statusFilter: 'all',
      typeFilter: 'all',
      dateFilter: 'all',
    });
  }, []);

  const hasActiveFilters = filters.searchTerm !== '' || 
    filters.statusFilter !== 'all' || 
    filters.typeFilter !== 'all' || 
    filters.dateFilter !== 'all';

  // Set up real-time subscription for notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('New notification received:', payload);
          queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });

          const newNotification = payload.new as Notification;
          const toastableTypes = [
            'task_assigned', 'task_completed', 'task_updated', 'task_deleted',
            'email_opened', 'email_replied', 'email_bounced'
          ];
          
          if (toastableTypes.includes(newNotification.notification_type)) {
            const titles: Record<string, string> = {
              'task_assigned': 'Task Assigned',
              'task_completed': 'Task Completed',
              'task_updated': 'Task Updated',
              'task_deleted': 'Task Deleted',
              'email_opened': 'Email Opened',
              'email_replied': 'Email Reply Received',
              'email_bounced': 'Email Delivery Failed',
            };
            
            toast({
              title: titles[newNotification.notification_type] || 'New Notification',
              description: newNotification.message,
              duration: 5000,
              variant: newNotification.notification_type === 'email_bounced' ? 'destructive' : 'default',
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, toast]);

  return {
    notifications,
    unreadCount,
    loading,
    currentPage,
    totalNotifications,
    itemsPerPage,
    setItemsPerPage,
    filters,
    updateFilters,
    clearFilters,
    hasActiveFilters,
    markAsRead,
    markAllAsRead,
    bulkMarkAsRead,
    deleteNotification,
    bulkDelete,
    clearAllRead,
    fetchNotifications,
    setCurrentPage
  };
};
