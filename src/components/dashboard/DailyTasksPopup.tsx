import { useState, useEffect, useMemo, useCallback } from 'react';
import { format, startOfDay, isBefore, formatDistanceToNow } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Calendar, 
  ListTodo, 
  AlertTriangle,
  Building2,
  User,
  Target,
  Briefcase,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { Task, TaskStatus } from '@/types/task';
import { useNavigate } from 'react-router-dom';
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal';
import { cn } from '@/lib/utils';

const POPUP_STORAGE_KEY = 'daily-tasks-popup-last-shown';
const DONT_SHOW_TODAY_KEY = 'daily-tasks-dont-show-today';

interface DailyTasksPopupProps {
  onViewTask?: (task: Task) => void;
}

const priorityOrder = { high: 0, medium: 1, low: 2 };
const priorityColors = {
  high: 'border-l-destructive',
  medium: 'border-l-warning',
  low: 'border-l-emerald-500'
};
const priorityDotColors = {
  high: 'bg-destructive',
  medium: 'bg-warning',
  low: 'bg-emerald-500'
};

const moduleIcons: Record<string, React.ReactNode> = {
  accounts: <Building2 className="h-4 w-4" />,
  contacts: <User className="h-4 w-4" />,
  leads: <Target className="h-4 w-4" />,
  deals: <Briefcase className="h-4 w-4" />,
  meetings: <Calendar className="h-4 w-4" />,
};

export const DailyTasksPopup = ({ onViewTask }: DailyTasksPopupProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showOverdue, setShowOverdue] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [dontShowToday, setDontShowToday] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');

  // Pre-check query: Check if there are pending tasks (runs even when popup is closed)
  const { data: hasPendingTasks = false } = useQuery({
    queryKey: ['pending-tasks-check', user?.id, today],
    queryFn: async () => {
      if (!user?.id) return false;
      
      // Check for today's pending tasks
      const { count: todayCount } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to', user.id)
        .eq('due_date', today)
        .in('status', ['open', 'in_progress']);

      // Check for overdue tasks
      const { count: overdueCount } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to', user.id)
        .lt('due_date', today)
        .in('status', ['open', 'in_progress']);

      return (todayCount || 0) > 0 || (overdueCount || 0) > 0;
    },
    enabled: !!user?.id,
    staleTime: 60000,
  });

  // Check if popup should be shown today - now considers overdue tasks
  useEffect(() => {
    if (!user?.id) return;

    const lastShown = localStorage.getItem(POPUP_STORAGE_KEY);
    const dontShow = localStorage.getItem(DONT_SHOW_TODAY_KEY);
    const todayKey = startOfDay(new Date()).toISOString();

    // Clear old don't show key if it's from a previous day
    if (dontShow && dontShow !== todayKey) {
      localStorage.removeItem(DONT_SHOW_TODAY_KEY);
    }

    // Check if user requested to not show today
    if (dontShow === todayKey) {
      return;
    }

    // Show popup if:
    // 1. It hasn't been shown today yet, OR
    // 2. There are pending tasks (including overdue) and it's a new session
    const shouldShow = lastShown !== todayKey || (hasPendingTasks && !sessionStorage.getItem('popup-shown-this-session'));

    if (shouldShow && hasPendingTasks) {
      const timer = setTimeout(() => {
        setOpen(true);
        sessionStorage.setItem('popup-shown-this-session', 'true');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [user?.id, hasPendingTasks]);

  // Fetch today's tasks with related entity names
  const { data: todaysTasks = [], isLoading: isLoadingToday } = useQuery({
    queryKey: ['todays-tasks', user?.id, today],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          leads:lead_id(lead_name, company_name),
          contacts:contact_id(contact_name, company_name),
          deals:deal_id(deal_name, customer_name),
          accounts:account_id(company_name),
          meetings:meeting_id(subject)
        `)
        .eq('assigned_to', user.id)
        .eq('due_date', today)
        .order('due_time', { ascending: true, nullsFirst: false });

      if (error) {
        console.error('Error fetching today\'s tasks:', error);
        return [];
      }

      return (data || []).map(task => ({
        ...task,
        lead_name: task.leads?.lead_name,
        lead_account_name: task.leads?.company_name,
        contact_name: task.contacts?.contact_name,
        contact_account_name: task.contacts?.company_name,
        deal_name: task.deals?.deal_name,
        account_name: task.accounts?.company_name,
        meeting_subject: task.meetings?.subject,
      })) as Task[];
    },
    enabled: !!user?.id && open,
    staleTime: 60000,
  });

  // Fetch overdue tasks
  const { data: overdueTasks = [], isLoading: isLoadingOverdue } = useQuery({
    queryKey: ['overdue-tasks', user?.id, today],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          leads:lead_id(lead_name, company_name),
          contacts:contact_id(contact_name, company_name),
          deals:deal_id(deal_name, customer_name),
          accounts:account_id(company_name),
          meetings:meeting_id(subject)
        `)
        .eq('assigned_to', user.id)
        .lt('due_date', today)
        .in('status', ['open', 'in_progress'])
        .order('due_date', { ascending: true });

      if (error) {
        console.error('Error fetching overdue tasks:', error);
        return [];
      }

      return (data || []).map(task => ({
        ...task,
        lead_name: task.leads?.lead_name,
        lead_account_name: task.leads?.company_name,
        contact_name: task.contacts?.contact_name,
        contact_account_name: task.contacts?.company_name,
        deal_name: task.deals?.deal_name,
        account_name: task.accounts?.company_name,
        meeting_subject: task.meetings?.subject,
      })) as Task[];
    },
    enabled: !!user?.id && open,
    staleTime: 60000,
  });

  const isLoading = isLoadingToday || isLoadingOverdue;

  // Toggle task completion
  const toggleTaskMutation = useMutation({
    mutationFn: async ({ taskId, currentStatus }: { taskId: string; currentStatus: string }) => {
      const newStatus = currentStatus === 'completed' ? 'open' : 'completed';
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus as TaskStatus, 
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null 
        })
        .eq('id', taskId);

      if (error) throw error;
      return newStatus;
    },
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['todays-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['pending-tasks-check'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['user-tasks'] });
      toast.success(newStatus === 'completed' ? 'Task completed!' : 'Task reopened');
    },
    onError: () => {
      toast.error('Failed to update task');
    },
  });

  // Filter and sort tasks - ALWAYS sort by priority (removed sort options)
  const sortedTodayTasks = useMemo(() => {
    let tasks = [...todaysTasks];

    if (!showCompleted) {
      tasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
    }

    // Always sort by priority
    tasks.sort((a, b) => {
      return (priorityOrder[a.priority as keyof typeof priorityOrder] || 2) - 
             (priorityOrder[b.priority as keyof typeof priorityOrder] || 2);
    });

    return tasks;
  }, [todaysTasks, showCompleted]);

  // All tasks for keyboard navigation
  const allNavigableTasks = useMemo(() => {
    const tasks: Task[] = [];
    if (showOverdue) {
      tasks.push(...overdueTasks);
    }
    tasks.push(...sortedTodayTasks);
    return tasks;
  }, [overdueTasks, sortedTodayTasks, showOverdue]);

  // Calculate stats - include overdue tasks in totals
  const completedToday = todaysTasks.filter(t => t.status === 'completed').length;
  const pendingTodayCount = todaysTasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length;
  const overdueCount = overdueTasks.length;
  const totalPending = pendingTodayCount + overdueCount;
  const totalAll = todaysTasks.length + overdueCount;
  const progressPercent = totalAll > 0 ? (completedToday / totalAll) * 100 : 0;
  const highPriorityCount = sortedTodayTasks.filter(t => t.priority === 'high').length + 
                           overdueTasks.filter(t => t.priority === 'high').length;

  // Handle closing and remember that we showed it today
  const handleClose = useCallback(() => {
    const todayKey = startOfDay(new Date()).toISOString();
    localStorage.setItem(POPUP_STORAGE_KEY, todayKey);
    
    if (dontShowToday) {
      localStorage.setItem(DONT_SHOW_TODAY_KEY, todayKey);
    }
    
    setOpen(false);
    setSelectedIndex(-1);
  }, [dontShowToday]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          handleClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, allNavigableTasks.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0)); // Fixed: don't go below 0
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && allNavigableTasks[selectedIndex]) {
            const task = allNavigableTasks[selectedIndex];
            toggleTaskMutation.mutate({
              taskId: task.id,
              currentStatus: task.status
            });
          }
          break;
        case 'v':
          if (selectedIndex >= 0 && allNavigableTasks[selectedIndex]) {
            setSelectedTask(allNavigableTasks[selectedIndex]);
            setIsDetailModalOpen(true);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, selectedIndex, allNavigableTasks, handleClose, toggleTaskMutation]);

  // Format time display
  const formatTime = (time: string | null) => {
    if (!time) return null;
    // Handle midnight properly
    if (time === '00:00:00') {
      return '12:00 AM';
    }
    try {
      const [hours, minutes] = time.split(':');
      const date = new Date();
      date.setHours(parseInt(hours), parseInt(minutes));
      return format(date, 'h:mm a');
    } catch {
      return null;
    }
  };

  // Get relative time for upcoming tasks
  const getRelativeTime = (dueDate: string, dueTime: string | null) => {
    try {
      const date = new Date(dueDate);
      if (dueTime && dueTime !== '00:00:00') {
        const [hours, minutes] = dueTime.split(':');
        date.setHours(parseInt(hours), parseInt(minutes));
      }
      
      if (isBefore(date, new Date())) return null;
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return null;
    }
  };

  // Get linked entity info
  const getLinkedEntity = (task: Task) => {
    if (task.account_id && task.account_name) {
      return { type: 'accounts', name: task.account_name, icon: moduleIcons.accounts };
    }
    if (task.contact_id && task.contact_name) {
      return { type: 'contacts', name: task.contact_name, icon: moduleIcons.contacts };
    }
    if (task.lead_id && task.lead_name) {
      return { type: 'leads', name: task.lead_name, icon: moduleIcons.leads };
    }
    if (task.deal_id && task.deal_name) {
      return { type: 'deals', name: task.deal_name, icon: moduleIcons.deals };
    }
    if (task.meeting_id && task.meeting_subject) {
      return { type: 'meetings', name: task.meeting_subject, icon: moduleIcons.meetings };
    }
    return null;
  };

  // Handle task click to open detail modal
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsDetailModalOpen(true);
  };

  // Handle edit from detail modal
  const handleEditTask = (task: Task) => {
    setIsDetailModalOpen(false);
    handleClose();
    onViewTask?.(task);
  };

  // Compact Task Card Component - INCREASED SIZE BY 50%
  const TaskCard = ({ task, isOverdue = false, isSelected = false }: { task: Task; isOverdue?: boolean; isSelected?: boolean }) => {
    const linkedEntity = getLinkedEntity(task);
    const formattedTime = formatTime(task.due_time);
    const relativeTime = !isOverdue ? getRelativeTime(task.due_date || '', task.due_time) : null;
    const isCompleted = task.status === 'completed';
    const priority = task.priority as keyof typeof priorityColors;
    const isToggling = toggleTaskMutation.isPending;

    return (
      <div
        className={cn(
          "group relative flex items-start gap-4 p-4 rounded-lg border-l-4 transition-all cursor-pointer",
          isOverdue ? "border-l-destructive bg-destructive/5" : priorityColors[priority] || 'border-l-border',
          isCompleted && "opacity-60",
          isSelected && "ring-2 ring-primary ring-offset-2",
          "hover:bg-accent/50"
        )}
        onClick={() => handleTaskClick(task)}
      >
        {/* Priority Dot - larger */}
        <div className={cn(
          "w-3 h-3 rounded-full flex-shrink-0 mt-1.5",
          isOverdue ? "bg-destructive" : priorityDotColors[priority] || 'bg-muted'
        )} />

        {/* Checkbox - larger */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleTaskMutation.mutate({ taskId: task.id, currentStatus: task.status });
          }}
          className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors mt-0.5"
          disabled={isToggling}
        >
          {isToggling ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : isCompleted ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          ) : (
            <Circle className="h-6 w-6" />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className={cn(
              "text-lg font-medium", // Increased from text-base
              isCompleted && "line-through text-muted-foreground"
            )}>
              {task.title}
            </span>
            
            {formattedTime && (
              <Badge variant="outline" className="text-sm px-2 py-0.5 h-6 flex-shrink-0">
                <Clock className="h-3.5 w-3.5 mr-1" />
                {formattedTime}
              </Badge>
            )}

            {priority === 'high' && !isCompleted && (
              <Badge variant="destructive" className="text-sm px-2 py-0.5 h-6 flex-shrink-0">
                <AlertCircle className="h-3.5 w-3.5 mr-1" />
                High
              </Badge>
            )}
          </div>

          {/* Description preview - increased max width */}
          {task.description && (
            <p className="text-sm text-muted-foreground truncate mt-1.5 max-w-[500px]">
              {task.description}
            </p>
          )}
          
          {linkedEntity && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-muted-foreground">{linkedEntity.icon}</span>
              <span className="text-sm text-muted-foreground truncate">{linkedEntity.name}</span>
            </div>
          )}
        </div>

        {/* Quick Actions - visible on hover */}
        <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTaskClick(task);
                }}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>View details</TooltipContent>
          </Tooltip>
        </div>

        {/* Relative time on right */}
        {relativeTime && !isCompleted && (
          <span className="text-sm text-muted-foreground flex-shrink-0 group-hover:hidden">
            {relativeTime}
          </span>
        )}

        {isOverdue && (
          <Badge variant="destructive" className="text-sm px-2 py-0.5 h-6 flex-shrink-0 group-hover:hidden">
            {format(new Date(task.due_date!), 'MMM d')}
          </Badge>
        )}
      </div>
    );
  };

  if (!open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-2xl p-0 gap-0"> {/* Increased from sm:max-w-xl */}
          {/* Header */}
          <DialogHeader className="p-6 pb-5 border-b"> {/* Increased padding */}
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <ListTodo className="w-7 h-7 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-2xl">Today's Tasks</DialogTitle> {/* Increased from text-xl */}
                <DialogDescription className="text-base">
                  {format(new Date(), 'EEEE, MMMM d, yyyy')}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Progress Bar - includes overdue tasks */}
          {totalAll > 0 && (
            <div className="px-6 py-4 border-b bg-muted/30">
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                <span>{completedToday} of {totalAll} completed {overdueCount > 0 && `(${overdueCount} overdue)`}</span>
                <span className="font-medium">{Math.round(progressPercent)}%</span>
              </div>
              <Progress value={progressPercent} className="h-2.5" />
            </div>
          )}

          {/* Quick Stats */}
          {(highPriorityCount > 0 || overdueCount > 0) && (
            <div className="px-6 py-3 flex items-center gap-5 text-sm border-b bg-muted/10">
              {highPriorityCount > 0 && (
                <span className="flex items-center gap-2 text-destructive">
                  <span className="w-2.5 h-2.5 rounded-full bg-destructive" />
                  {highPriorityCount} high priority
                </span>
              )}
              {overdueCount > 0 && (
                <span className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
                  <AlertTriangle className="h-4 w-4" />
                  {overdueCount} overdue
                </span>
              )}
            </div>
          )}

          {/* Filters - removed sort dropdown */}
          <div className="flex items-center justify-end px-6 py-3 border-b bg-muted/20">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-sm gap-2"
              onClick={() => setShowCompleted(!showCompleted)}
            >
              {showCompleted ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showCompleted ? 'Hide' : 'Show'} done
            </Button>
          </div>

          {/* Content - increased max height */}
          <ScrollArea className="max-h-[70vh]"> {/* Increased from 55vh */}
            <div className="p-5 space-y-5"> {/* Increased padding and spacing */}
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Overdue Section */}
                  {overdueTasks.length > 0 && (
                    <div className="space-y-3">
                      <button
                        onClick={() => setShowOverdue(!showOverdue)}
                        className="flex items-center gap-2 text-base font-medium text-destructive w-full"
                      >
                        <AlertTriangle className="h-5 w-5" />
                        <span>Overdue ({overdueTasks.length})</span>
                        {showOverdue ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
                      </button>
                      
                      {showOverdue && (
                        <div className="space-y-3">
                          {overdueTasks.map((task, index) => (
                            <TaskCard 
                              key={task.id} 
                              task={task} 
                              isOverdue 
                              isSelected={selectedIndex === index}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Today's Tasks */}
                  {sortedTodayTasks.length > 0 ? (
                    <div className="space-y-3">
                      {overdueTasks.length > 0 && (
                        <div className="text-base font-medium text-muted-foreground pt-2">
                          Due Today ({sortedTodayTasks.length})
                        </div>
                      )}
                      <div className="space-y-3">
                        {sortedTodayTasks.map((task, index) => {
                          const actualIndex = showOverdue ? overdueTasks.length + index : index;
                          return (
                            <TaskCard 
                              key={task.id} 
                              task={task}
                              isSelected={selectedIndex === actualIndex}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ) : overdueTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-5">
                        <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                      </div>
                      <p className="font-semibold text-xl text-foreground">All caught up!</p>
                      <p className="text-base text-muted-foreground mt-2">
                        No tasks due today. Enjoy your day! 🎉
                      </p>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="flex justify-between items-center p-5 border-t bg-muted/20">
            <label className="flex items-center gap-2.5 text-sm text-muted-foreground cursor-pointer">
              <Checkbox 
                checked={dontShowToday}
                onCheckedChange={(checked) => setDontShowToday(checked as boolean)}
              />
              Don't show again today
            </label>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="default" onClick={handleClose}>
                Dismiss
              </Button>
              <Button 
                size="default" 
                onClick={() => {
                  handleClose();
                  navigate('/tasks');
                }}
              >
                View All Tasks
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          open={isDetailModalOpen}
          onOpenChange={(open) => {
            setIsDetailModalOpen(open);
            if (!open) {
              setSelectedTask(null);
              // Refresh tasks when modal closes
              queryClient.invalidateQueries({ queryKey: ['todays-tasks'] });
              queryClient.invalidateQueries({ queryKey: ['overdue-tasks'] });
              queryClient.invalidateQueries({ queryKey: ['pending-tasks-check'] });
            }
          }}
          task={selectedTask}
          onEdit={handleEditTask}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ['todays-tasks'] });
            queryClient.invalidateQueries({ queryKey: ['overdue-tasks'] });
            queryClient.invalidateQueries({ queryKey: ['pending-tasks-check'] });
          }}
        />
      )}
    </>
  );
};
