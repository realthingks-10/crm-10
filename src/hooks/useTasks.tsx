import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Task, CreateTaskData, TaskStatus } from '@/types/task';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Helper to send task notification email
const sendTaskNotificationEmail = async (
  taskId: string,
  notificationType: string,
  recipientUserId: string,
  senderUserId: string, // The user who performed the action
  taskTitle: string,
  taskDescription?: string,
  taskDueDate?: string,
  taskPriority?: string,
  updatedByName?: string,
  assigneeName?: string
) => {
  try {
    await supabase.functions.invoke('send-task-notification', {
      body: {
        taskId,
        notificationType,
        recipientUserId,
        senderUserId,
        taskTitle,
        taskDescription,
        taskDueDate,
        taskPriority,
        updatedByName,
        assigneeName,
      },
    });
    console.log(`Task notification email sent: ${notificationType} from ${senderUserId} to ${recipientUserId}`);
  } catch (error) {
    console.error('Failed to send task notification email:', error);
  }
};

// Helper to get current user's display name
const getCurrentUserName = async (userId: string): Promise<string> => {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single();
    return data?.full_name || 'Someone';
  } catch {
    return 'Someone';
  }
};

export const useTasks = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch tasks with React Query caching
  const { data: tasks = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['tasks', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          leads:lead_id (lead_name, account_id, accounts:account_id (company_name)),
          contacts:contact_id (contact_name, account_id, accounts:account_id (company_name)),
          deals:deal_id (deal_name, stage),
          accounts:account_id (company_name),
          meetings:meeting_id (subject, start_time)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const transformedData = (data || []).map(task => ({
        ...task,
        lead_name: task.leads?.lead_name || null,
        contact_name: task.contacts?.contact_name || null,
        deal_name: task.deals?.deal_name || null,
        deal_stage: task.deals?.stage || null,
        account_name: task.accounts?.company_name || null,
        meeting_subject: task.meetings?.subject || null,
        contact_account_name: task.contacts?.accounts?.company_name || null,
        lead_account_name: task.leads?.accounts?.company_name || null,
      })) as Task[];

      return transformedData;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: CreateTaskData) => {
      if (!user?.id) throw new Error('User not authenticated');

      // Sanitize special placeholder values that could break DB insert
      const sanitizedData = {
        ...taskData,
        assigned_to: taskData.assigned_to && taskData.assigned_to !== 'unassigned' ? taskData.assigned_to : null,
        due_time: (taskData as any).due_time && (taskData as any).due_time !== 'none' ? (taskData as any).due_time : null,
        created_by: user.id,
      };

      const { data, error } = await supabase
        .from('tasks')
        .insert(sanitizedData)
        .select()
        .single();

      if (error) throw error;

      // Create notification for assigned user if different from creator
      if (taskData.assigned_to && taskData.assigned_to !== user.id) {
        await supabase.from('notifications').insert({
          user_id: taskData.assigned_to,
          message: `You have been assigned a new task: ${taskData.title}`,
          notification_type: 'task_assigned',
        });

        // Send email notification - sender is the creator
        const creatorName = await getCurrentUserName(user.id);
        sendTaskNotificationEmail(
          data.id,
          'task_assigned',
          taskData.assigned_to,
          user.id, // sender is the creator
          taskData.title,
          taskData.description,
          taskData.due_date,
          taskData.priority,
          creatorName
        );
      }

      return data;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Task created successfully" });
      queryClient.invalidateQueries({ queryKey: ['tasks', user?.id] });
    },
    onError: (error: any) => {
      console.error('Error creating task:', error);
      toast({ title: "Error", description: error.message || "Failed to create task", variant: "destructive" });
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates, originalTask }: { taskId: string; updates: Partial<Task>; originalTask?: Task }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const updateData: any = { ...updates };
      
      // If status is changing to completed, set completed_at
      if (updates.status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      } else if (updates.status) {
        updateData.completed_at = null;
      }

      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId);

      if (error) throw error;

      // Get current user's name for notifications
      const updaterName = await getCurrentUserName(user.id);

      // Create notifications for changes
      if (originalTask) {
        // Handle reassignment notifications
        if (updates.assigned_to && updates.assigned_to !== originalTask.assigned_to) {
          // Notify NEW assignee (if different from updater)
          if (updates.assigned_to !== user.id) {
            await supabase.from('notifications').insert({
              user_id: updates.assigned_to,
              message: `You have been assigned a task: ${originalTask.title}`,
              notification_type: 'task_assigned',
            });

            // Send email notification for assignment - sender is the updater
            sendTaskNotificationEmail(
              taskId,
              'task_assigned',
              updates.assigned_to,
              user.id, // sender is the updater
              originalTask.title,
              originalTask.description || undefined,
              originalTask.due_date || undefined,
              originalTask.priority,
              updaterName
            );
          }

          // Notify OLD assignee that they've been unassigned (if different from updater)
          if (originalTask.assigned_to && originalTask.assigned_to !== user.id) {
            await supabase.from('notifications').insert({
              user_id: originalTask.assigned_to,
              message: `You have been unassigned from task: ${originalTask.title}`,
              notification_type: 'task_unassigned',
            });

            // Send email notification for unassignment - sender is the updater
            sendTaskNotificationEmail(
              taskId,
              'task_unassigned',
              originalTask.assigned_to,
              user.id, // sender is the updater
              originalTask.title,
              originalTask.description || undefined,
              originalTask.due_date || undefined,
              originalTask.priority,
              updaterName
            );
          }
        }

        // Handle status change notifications
        if (updates.status && updates.status !== originalTask.status) {
          const statusMessages: Record<string, string> = {
            'in_progress': `Task in progress: ${originalTask.title}`,
            'completed': `Task completed: ${originalTask.title}`,
            'cancelled': `Task cancelled: ${originalTask.title}`,
            'open': `Task reopened: ${originalTask.title}`,
          };

          // Notify CREATOR (if updater is not the creator)
          if (originalTask.created_by && originalTask.created_by !== user.id) {
            await supabase.from('notifications').insert({
              user_id: originalTask.created_by,
              message: statusMessages[updates.status] || `Task updated: ${originalTask.title}`,
              notification_type: updates.status === 'completed' ? 'task_completed' : 'task_updated',
            });

            // Send email notification for status change - sender is the updater
            sendTaskNotificationEmail(
              taskId,
              `status_${updates.status}` as any,
              originalTask.created_by,
              user.id, // sender is the updater
              originalTask.title,
              originalTask.description || undefined,
              originalTask.due_date || undefined,
              originalTask.priority,
              updaterName
            );
          }

          // Notify ASSIGNEE (if different from updater AND different from creator)
          if (originalTask.assigned_to && 
              originalTask.assigned_to !== user.id && 
              originalTask.assigned_to !== originalTask.created_by) {
            await supabase.from('notifications').insert({
              user_id: originalTask.assigned_to,
              message: statusMessages[updates.status] || `Task updated: ${originalTask.title}`,
              notification_type: updates.status === 'completed' ? 'task_completed' : 'task_updated',
            });

            // Send email notification for status change - sender is the updater
            sendTaskNotificationEmail(
              taskId,
              `status_${updates.status}` as any,
              originalTask.assigned_to,
              user.id, // sender is the updater
              originalTask.title,
              originalTask.description || undefined,
              originalTask.due_date || undefined,
              originalTask.priority,
              updaterName
            );
          }
        }

        // Notify assigned user on due date change (if not the updater)
        if (updates.due_date && updates.due_date !== originalTask.due_date && originalTask.assigned_to && originalTask.assigned_to !== user.id) {
          await supabase.from('notifications').insert({
            user_id: originalTask.assigned_to,
            message: `Due date changed for task: ${originalTask.title}`,
            notification_type: 'task_updated',
          });
        }

        // Notify assigned user on priority change (if not the updater)
        if (updates.priority && updates.priority !== originalTask.priority && originalTask.assigned_to && originalTask.assigned_to !== user.id) {
          await supabase.from('notifications').insert({
            user_id: originalTask.assigned_to,
            message: `Priority changed to ${updates.priority} for task: ${originalTask.title}`,
            notification_type: 'task_updated',
          });
        }
      }

      return { taskId, updates };
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Task updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['tasks', user?.id] });
    },
    onError: (error: any) => {
      console.error('Error updating task:', error);
      toast({ title: "Error", description: error.message || "Failed to update task", variant: "destructive" });
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!user?.id) throw new Error('User not authenticated');

      // Fetch task before deleting to get creator and assignee
      const { data: taskToDelete } = await supabase
        .from('tasks')
        .select('title, created_by, assigned_to')
        .eq('id', taskId)
        .single();

      const deleterName = await getCurrentUserName(user.id);

      // Notify creator (if deleter is not the creator)
      if (taskToDelete?.created_by && taskToDelete.created_by !== user.id) {
        await supabase.from('notifications').insert({
          user_id: taskToDelete.created_by,
          message: `${deleterName} deleted task: ${taskToDelete.title}`,
          notification_type: 'task_deleted',
        });
      }

      // Notify assignee (if different from deleter and creator)
      if (taskToDelete?.assigned_to && 
          taskToDelete.assigned_to !== user.id && 
          taskToDelete.assigned_to !== taskToDelete.created_by) {
        await supabase.from('notifications').insert({
          user_id: taskToDelete.assigned_to,
          message: `${deleterName} deleted task: ${taskToDelete.title}`,
          notification_type: 'task_deleted',
        });
      }

      // Delete the task
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      return taskId;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Task deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ['tasks', user?.id] });
    },
    onError: (error: any) => {
      console.error('Error deleting task:', error);
      toast({ title: "Error", description: error.message || "Failed to delete task", variant: "destructive" });
    },
  });

  // Wrapper functions to maintain API compatibility
  const createTask = async (taskData: CreateTaskData) => {
    try {
      const result = await createTaskMutation.mutateAsync(taskData);
      return result;
    } catch {
      return null;
    }
  };

  const updateTask = async (taskId: string, updates: Partial<Task>, originalTask?: Task) => {
    try {
      await updateTaskMutation.mutateAsync({ taskId, updates, originalTask });
      return true;
    } catch {
      return false;
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await deleteTaskMutation.mutateAsync(taskId);
      return true;
    } catch {
      return false;
    }
  };

  const fetchTasks = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    tasks,
    loading,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
  };
};
