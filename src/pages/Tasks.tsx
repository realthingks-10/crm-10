import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTasks } from '@/hooks/useTasks';
import { useAuth } from '@/hooks/useAuth';
import { useTasksImportExport } from '@/hooks/useTasksImportExport';
import { Task, TaskStatus, CreateTaskData, TaskModuleType, TaskModalContext } from '@/types/task';
import { TaskModal } from '@/components/tasks/TaskModal';
import { TaskListView } from '@/components/tasks/TaskListView';
import { TaskKanbanView } from '@/components/tasks/TaskKanbanView';
import { TaskCalendarView } from '@/components/tasks/TaskCalendarView';
import { TaskColumnCustomizer } from '@/components/tasks/TaskColumnCustomizer';
import { BulkDeleteConfirmDialog } from '@/components/shared/BulkDeleteConfirmDialog';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Loader2, List, LayoutGrid, CalendarDays, Trash2, Columns, Download, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ColumnPreference {
  visible_columns: string[];
  column_order: string[];
}

const defaultVisibleColumns = ['checkbox', 'title', 'status', 'priority', 'due_date', 'assigned_to', 'linked_to', 'created_by', 'actions'];

const Tasks = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialStatus = searchParams.get('status') || 'all';
  const { user } = useAuth();
  const { tasks, loading, fetchTasks, createTask, updateTask, deleteTask } = useTasks();
  const { importing, exporting, exportToCSV, importFromCSV } = useTasksImportExport(tasks, fetchTasks);
  
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'calendar'>('list');
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [initialStatusFilter, setInitialStatusFilter] = useState(initialStatus);
  const [initialOwnerFilter, setInitialOwnerFilter] = useState('all');
  const [showColumnCustomizer, setShowColumnCustomizer] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(defaultVisibleColumns);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  
  // Context for prefilling task modal when coming from another module
  const [prefillContext, setPrefillContext] = useState<TaskModalContext | undefined>();
  const [returnPath, setReturnPath] = useState<string | null>(null);
  const [returnViewId, setReturnViewId] = useState<string | null>(null);
  const [returnTab, setReturnTab] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load column preferences on mount
  useEffect(() => {
    const loadColumnPreferences = async () => {
      if (!user?.id) return;
      
      try {
        const { data } = await supabase
          .from('table_column_preferences')
          .select('column_config')
          .eq('user_id', user.id)
          .eq('module_name', 'tasks')
          .maybeSingle();

        if (data?.column_config) {
          const config = data.column_config as unknown as ColumnPreference;
          if (config.visible_columns && Array.isArray(config.visible_columns)) {
            setVisibleColumns(config.visible_columns);
          }
          if (config.column_order && Array.isArray(config.column_order)) {
            setColumnOrder(config.column_order);
          }
        }
      } catch (error) {
        console.error('Error loading column preferences:', error);
      }
    };
    
    loadColumnPreferences();
  }, [user?.id]);

  const handleColumnsChange = (columns: string[], order?: string[]) => {
    setVisibleColumns(columns);
    if (order) setColumnOrder(order);
  };

  // Get owner parameter from URL - "me" means filter by current user
  const ownerParam = searchParams.get('owner');

  // Sync owner filter when URL has owner=me
  useEffect(() => {
    if (ownerParam === 'me' && user?.id) {
      setInitialOwnerFilter(user.id);
    } else if (!ownerParam) {
      setInitialOwnerFilter('all');
    }
  }, [ownerParam, user?.id]);

  // Sync status filter when URL changes
  useEffect(() => {
    const urlStatus = searchParams.get('status');
    if (urlStatus) {
      setInitialStatusFilter(urlStatus);
    }
  }, [searchParams]);

  // Handle create param from URL (from AccountDetailModal redirect)
  useEffect(() => {
    const createParam = searchParams.get('create');
    const moduleParam = searchParams.get('module');
    const recordIdParam = searchParams.get('recordId');
    const recordNameParam = searchParams.get('recordName');
    const returnParam = searchParams.get('return');
    const returnViewIdParam = searchParams.get('returnViewId');
    const returnTabParam = searchParams.get('returnTab');
    
    if (createParam === '1' && moduleParam && recordIdParam) {
      // Validate module is a valid TaskModuleType
      const validModules: TaskModuleType[] = ['accounts', 'contacts', 'leads', 'meetings', 'deals'];
      const module = validModules.includes(moduleParam as TaskModuleType) 
        ? (moduleParam as TaskModuleType) 
        : undefined;
      
      if (module) {
        // Set context for prefilling
        setPrefillContext({
          module,
          recordId: recordIdParam,
          recordName: recordNameParam || undefined,
          locked: true
        });
        setReturnPath(returnParam);
        setReturnViewId(returnViewIdParam);
        setReturnTab(returnTabParam);
        
        // Open create modal
        setEditingTask(null);
        setShowModal(true);
        
        // Clear create params from URL but keep return params in state
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('create');
        newParams.delete('module');
        newParams.delete('recordId');
        newParams.delete('recordName');
        newParams.delete('return');
        newParams.delete('returnViewId');
        newParams.delete('returnTab');
        const newUrl = newParams.toString() ? `/tasks?${newParams.toString()}` : '/tasks';
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [searchParams]);

  // Handle viewId from URL (from global search or edit redirect)
  useEffect(() => {
    const viewId = searchParams.get('viewId');
    const returnParam = searchParams.get('return');
    const returnViewIdParam = searchParams.get('returnViewId');
    const returnTabParam = searchParams.get('returnTab');
    
    if (viewId && tasks.length > 0) {
      const taskToView = tasks.find(t => t.id === viewId);
      if (taskToView) {
        // Store return params if present
        if (returnParam) {
          setReturnPath(returnParam);
          setReturnViewId(returnViewIdParam);
          setReturnTab(returnTabParam);
        }
        
        setEditingTask(taskToView);
        setShowModal(true);
        // Clear the viewId from URL after opening
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('viewId');
        newParams.delete('return');
        newParams.delete('returnViewId');
        newParams.delete('returnTab');
        const newUrl = newParams.toString() ? `/tasks?${newParams.toString()}` : '/tasks';
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [searchParams, tasks]);

  // Navigate back to the return path (e.g., AccountDetailModal)
  const navigateBack = () => {
    if (returnPath && returnViewId) {
      const params = new URLSearchParams();
      params.set('viewId', returnViewId);
      if (returnTab) params.set('tab', returnTab);
      navigate(`${returnPath}?${params.toString()}`);
    }
    // Clear return state
    setReturnPath(null);
    setReturnViewId(null);
    setReturnTab(null);
    setPrefillContext(undefined);
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setShowModal(true);
  };

  const handleDelete = (taskId: string) => {
    setDeleteTaskId(taskId);
  };

  const confirmDelete = async () => {
    if (deleteTaskId) {
      await deleteTask(deleteTaskId);
      setDeleteTaskId(null);
    }
  };

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    const task = tasks.find(t => t.id === taskId);
    await updateTask(taskId, { status }, task);
  };

  const handleToggleComplete = async (task: Task) => {
    const newStatus: TaskStatus = task.status === 'completed' ? 'open' : 'completed';
    await updateTask(task.id, { status: newStatus }, task);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTask(null);
    
    // If we came from another module, navigate back
    if (returnPath && returnViewId) {
      navigateBack();
    } else {
      setPrefillContext(undefined);
    }
  };

  // Handle task submit with return navigation
  const handleTaskSubmit = async (data: CreateTaskData) => {
    const result = await createTask(data);
    if (result && returnPath && returnViewId) {
      navigateBack();
    }
    return result;
  };

  // Handle task update with return navigation  
  const handleTaskUpdate = async (taskId: string, data: Partial<Task>, original?: Task) => {
    const result = await updateTask(taskId, data, original);
    if (result && returnPath && returnViewId) {
      navigateBack();
    }
    return result;
  };

  const handleBulkDelete = async () => {
    if (selectedTasks.length === 0) return;
    setBulkDeleting(true);
    
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .in('id', selectedTasks);

      if (error) throw error;

      toast({ title: 'Success', description: `Deleted ${selectedTasks.length} tasks` });
      setSelectedTasks([]);
      fetchTasks();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setBulkDeleting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await importFromCSV(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Show skeleton in content area instead of blocking spinner
  const showSkeleton = loading && tasks.length === 0;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Hidden file input for import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv"
        className="hidden"
      />

      {/* Fixed Header */}
      <div className="flex-shrink-0 bg-background">
        <div className="px-6 h-16 flex items-center border-b w-full">
          <div className="flex items-center justify-between w-full">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl text-foreground font-semibold">Tasks</h1>
            </div>
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5">
                <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className="gap-1.5 h-8 px-2.5 text-xs">
                  <List className="h-3.5 w-3.5" />
                  List
                </Button>
                <Button variant={viewMode === 'kanban' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('kanban')} className="gap-1.5 h-8 px-2.5 text-xs">
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Kanban
                </Button>
                <Button variant={viewMode === 'calendar' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('calendar')} className="gap-1.5 h-8 px-2.5 text-xs">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Calendar
                </Button>
              </div>

              {/* Actions Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setShowColumnCustomizer(true)}>
                    <Columns className="h-4 w-4 mr-2" />
                    Columns
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleImportClick} disabled={importing}>
                    <Upload className="h-4 w-4 mr-2" />
                    {importing ? 'Importing...' : 'Import CSV'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToCSV} disabled={exporting}>
                    <Download className="h-4 w-4 mr-2" />
                    {exporting ? 'Exporting...' : 'Export CSV'}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    disabled={selectedTasks.length === 0} 
                    className="text-destructive focus:text-destructive"
                    onClick={() => setShowBulkDeleteDialog(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected ({selectedTasks.length})
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button size="sm" className="gap-1.5" onClick={() => setShowModal(true)}>
                <Plus className="w-4 h-4" />
                Add Task
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-auto px-4 pt-2 pb-4">
        {showSkeleton ? (
          <div className="space-y-4">
            <div className="h-10 bg-muted animate-pulse rounded" />
            <div className="h-64 bg-muted animate-pulse rounded" />
          </div>
        ) : (
          <>
            {viewMode === 'list' && (
              <TaskListView 
                tasks={tasks} 
                onEdit={handleEdit} 
                onDelete={handleDelete} 
                onStatusChange={handleStatusChange} 
                onToggleComplete={handleToggleComplete} 
                initialStatusFilter={initialStatusFilter} 
                initialOwnerFilter={initialOwnerFilter}
                selectedTasks={selectedTasks}
                onSelectionChange={setSelectedTasks}
                visibleColumns={visibleColumns}
                columnOrder={columnOrder}
              />
            )}
            {viewMode === 'kanban' && (
              <TaskKanbanView 
                tasks={tasks} 
                onEdit={handleEdit} 
                onDelete={handleDelete} 
                onStatusChange={handleStatusChange}
              />
            )}
            {viewMode === 'calendar' && (
              <TaskCalendarView 
                tasks={tasks} 
                onEdit={handleEdit}
              />
            )}
          </>
        )}
      </div>

      {/* Task Modal */}
      <TaskModal 
        open={showModal} 
        onOpenChange={handleCloseModal} 
        task={editingTask} 
        onSubmit={handleTaskSubmit} 
        onUpdate={handleTaskUpdate}
        context={prefillContext}
      />

      {/* Column Customizer */}
      <TaskColumnCustomizer open={showColumnCustomizer} onOpenChange={setShowColumnCustomizer} onColumnsChange={handleColumnsChange} />

      {/* Single Delete Confirmation */}
      <AlertDialog open={!!deleteTaskId} onOpenChange={() => setDeleteTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <BulkDeleteConfirmDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        onConfirm={handleBulkDelete}
        count={selectedTasks.length}
        itemType="task"
        loading={bulkDeleting}
      />
    </div>
  );
};

export default Tasks;
