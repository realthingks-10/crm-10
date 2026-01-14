import { useState, useEffect } from 'react';
import { Task, TaskStatus, TaskModuleType } from '@/types/task';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUserDisplayNames } from '@/hooks/useUserDisplayNames';
import { RecordChangeHistory } from '@/components/shared/RecordChangeHistory';
import {
  CheckSquare,
  User,
  Building2,
  Briefcase,
  Users,
  Calendar,
  Clock,
  Edit,
  FileText,
  Link2,
  ListTodo,
  Activity,
  Loader2,
  Plus,
  History,
} from 'lucide-react';
import { format } from 'date-fns';
import { formatDateTimeStandard } from '@/utils/formatUtils';

interface TaskDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  onEdit: (task: Task) => void;
  onUpdate?: () => void;
}

interface Subtask {
  id: string;
  title: string;
  is_completed: boolean;
  order_index: number;
}

const priorityColors = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800',
  low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800',
};

const statusColors = {
  open: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
  in_progress: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-800',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400 border border-gray-200 dark:border-gray-700',
  deferred: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800',
};

const moduleIcons: Record<TaskModuleType, React.ElementType> = {
  accounts: Building2,
  contacts: User,
  leads: Users,
  meetings: Calendar,
  deals: Briefcase,
};

export const TaskDetailModal = ({
  open,
  onOpenChange,
  task,
  onEdit,
  onUpdate,
}: TaskDetailModalProps) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loadingSubtasks, setLoadingSubtasks] = useState(false);

  const userIds = [task?.assigned_to, task?.created_by].filter(Boolean) as string[];
  const { displayNames } = useUserDisplayNames(userIds);

  useEffect(() => {
    if (task && open) {
      fetchSubtasks();
    }
  }, [task?.id, open]);

  const fetchSubtasks = async () => {
    if (!task) return;
    setLoadingSubtasks(true);
    try {
      const { data, error } = await supabase
        .from('task_subtasks')
        .select('*')
        .eq('task_id', task.id)
        .order('order_index', { ascending: true });

      if (error) throw error;
      setSubtasks(data || []);
    } catch (error) {
      console.error('Error fetching subtasks:', error);
    } finally {
      setLoadingSubtasks(false);
    }
  };

  const toggleSubtask = async (subtask: Subtask) => {
    try {
      const { error } = await supabase
        .from('task_subtasks')
        .update({ is_completed: !subtask.is_completed })
        .eq('id', subtask.id);

      if (error) throw error;
      
      setSubtasks(prev => 
        prev.map(s => s.id === subtask.id ? { ...s, is_completed: !s.is_completed } : s)
      );
      onUpdate?.();
    } catch (error) {
      console.error('Error toggling subtask:', error);
    }
  };

  if (!task) return null;

  const getLinkedEntity = (): { icon: React.ElementType; name: string; type: string } | null => {
    if (!task.module_type) return null;
    
    const Icon = moduleIcons[task.module_type] || FileText;
    
    switch (task.module_type) {
      case 'accounts':
        return task.account_name ? { icon: Icon, name: task.account_name, type: 'Account' } : null;
      case 'contacts':
        return task.contact_name ? { icon: Icon, name: task.contact_name, type: 'Contact' } : null;
      case 'leads':
        return task.lead_name ? { icon: Icon, name: task.lead_name, type: 'Lead' } : null;
      case 'meetings':
        return task.meeting_subject ? { icon: Icon, name: task.meeting_subject, type: 'Meeting' } : null;
      case 'deals':
        return task.deal_name ? { icon: Icon, name: task.deal_name, type: 'Deal' } : null;
      default:
        return null;
    }
  };

  const linkedEntity = getLinkedEntity();
  const completedSubtasks = subtasks.filter(s => s.is_completed).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl flex items-center gap-2">
                <CheckSquare className="h-5 w-5" />
                {task.title}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={statusColors[task.status as keyof typeof statusColors] || statusColors.open}>
                  {task.status.replace('_', ' ')}
                </Badge>
                <Badge className={priorityColors[task.priority]}>
                  {task.priority} priority
                </Badge>
                {task.module_type && (
                  <Badge variant="outline" className="capitalize">{task.module_type}</Badge>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(task)}
              className="gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit Task
            </Button>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview" className="flex items-center gap-1">
              <CheckSquare className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-1">
              <Activity className="h-4 w-4" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Task Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {task.description && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Description</p>
                      <p className="text-sm whitespace-pre-wrap">{task.description}</p>
                    </div>
                  )}
                  {task.due_date && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Due: {format(new Date(task.due_date), 'dd/MM/yyyy')}</span>
                      {task.due_time && <span>at {task.due_time}</span>}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Assignment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {task.assigned_to && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>Assigned to: {displayNames[task.assigned_to] || 'Loading...'}</span>
                    </div>
                  )}
                  {task.created_by && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>Created by: {displayNames[task.created_by] || 'Loading...'}</span>
                    </div>
                  )}
                  {task.completed_at && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckSquare className="h-4 w-4 text-green-500" />
                      <span>Completed: {format(new Date(task.completed_at), 'dd/MM/yyyy')}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {linkedEntity && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Linked To</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <linkedEntity.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{linkedEntity.name}</p>
                      <p className="text-sm text-muted-foreground">{linkedEntity.type}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Subtasks */}
            {subtasks.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ListTodo className="h-4 w-4" />
                      Subtasks
                    </CardTitle>
                    <span className="text-sm text-muted-foreground">
                      {completedSubtasks} of {subtasks.length} completed
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {subtasks.map((subtask) => (
                      <div
                        key={subtask.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={subtask.is_completed}
                          onCheckedChange={() => toggleSubtask(subtask)}
                        />
                        <span className={subtask.is_completed ? 'line-through text-muted-foreground' : ''}>
                          {subtask.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Timestamps */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {task.created_at && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Created: {formatDateTimeStandard(task.created_at)}
                </span>
              )}
              {task.updated_at && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Updated: {formatDateTimeStandard(task.updated_at)}
                </span>
              )}
            </div>
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Task Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No activity logs available</p>
                  <p className="text-xs mt-1">Check History tab for changes</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Change History</CardTitle>
              </CardHeader>
              <CardContent>
                <RecordChangeHistory entityType="tasks" entityId={task.id} maxHeight="300px" />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
