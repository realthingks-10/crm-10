import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { formatDateTimeStandard } from '@/utils/formatUtils';
import { Task, TaskStatus, TaskModuleType } from '@/types/task';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Edit,
  Trash2,
  Search,
  User,
  Building2,
  Briefcase,
  Users,
  Calendar,
  FileText,
  AlertCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  ExternalLink,
} from 'lucide-react';
import { useUserDisplayNames } from '@/hooks/useUserDisplayNames';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { TaskDetailModal } from './TaskDetailModal';
import { RowActionsDropdown } from '@/components/RowActionsDropdown';
import { HighlightedText } from '@/components/shared/HighlightedText';
import { ClearFiltersButton } from '@/components/shared/ClearFiltersButton';
import { getTaskStatusColor, getTaskPriorityColor, getModuleTypeColor, getTaskStatusLabel } from '@/utils/statusBadgeUtils';

interface TaskListViewProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onToggleComplete: (task: Task) => void;
  initialStatusFilter?: string;
  initialOwnerFilter?: string;
  selectedTasks?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  visibleColumns?: string[];
  columnOrder?: string[];
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const moduleIcons: Record<TaskModuleType, React.ElementType> = {
  accounts: Building2,
  contacts: User,
  leads: Users,
  meetings: Calendar,
  deals: Briefcase,
};

const moduleRoutes: Record<TaskModuleType, string> = {
  accounts: '/accounts',
  contacts: '/contacts',
  leads: '/leads',
  meetings: '/meetings',
  deals: '/deals',
};

const defaultVisibleColumns = ['checkbox', 'title', 'status', 'priority', 'due_date', 'assigned_to', 'linked_to', 'created_by', 'actions'];

export const TaskListView = ({
  tasks,
  onEdit,
  onDelete,
  onStatusChange,
  onToggleComplete,
  initialStatusFilter = 'all',
  initialOwnerFilter = 'all',
  selectedTasks: externalSelectedTasks,
  onSelectionChange,
  visibleColumns = defaultVisibleColumns,
  columnOrder = [],
}: TaskListViewProps) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  // Default to hiding completed tasks unless explicitly set
  const [statusFilter, setStatusFilter] = useState<string>(
    initialStatusFilter === 'all' ? 'open,in_progress,cancelled' : initialStatusFilter
  );
  const [hideCompleted, setHideCompleted] = useState(initialStatusFilter === 'all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [assignedToFilter, setAssignedToFilter] = useState<string>(initialOwnerFilter);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortField, setSortField] = useState<string>('title');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Internal selection state - used when no external selection is provided
  const [internalSelectedTasks, setInternalSelectedTasks] = useState<string[]>([]);
  
  // Use external selection if provided, otherwise use internal
  const selectedTasks = externalSelectedTasks ?? internalSelectedTasks;
  const setSelectedTasks = onSelectionChange ?? setInternalSelectedTasks;

  // Sync statusFilter when initialStatusFilter prop changes (from URL)
  useEffect(() => {
    setStatusFilter(initialStatusFilter);
  }, [initialStatusFilter]);

  // Sync assignedToFilter when initialOwnerFilter prop changes (from URL)
  useEffect(() => {
    setAssignedToFilter(initialOwnerFilter);
  }, [initialOwnerFilter]);

  const assignedToIds = [...new Set(tasks.map(t => t.assigned_to).filter(Boolean))] as string[];
  const createdByIds = [...new Set(tasks.map(t => t.created_by).filter(Boolean))] as string[];
  const allUserIds = [...new Set([...assignedToIds, ...createdByIds])];
  const { displayNames } = useUserDisplayNames(allUserIds);

  const filteredTasks = useMemo(() => {
    const filtered = tasks.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Handle multiple statuses (comma-separated) or single status
      let matchesStatus = true;
      if (statusFilter !== 'all') {
        const allowedStatuses = statusFilter.split(',');
        matchesStatus = allowedStatuses.includes(task.status);
      }
      
      // Also check hideCompleted toggle
      if (hideCompleted && task.status === 'completed') {
        matchesStatus = false;
      }
      
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
      const matchesAssignedTo = assignedToFilter === 'all' || task.assigned_to === assignedToFilter;
      return matchesSearch && matchesStatus && matchesPriority && matchesAssignedTo;
    });

    // Sort filtered tasks
    return filtered.sort((a, b) => {
      let aValue: string | number | null = null;
      let bValue: string | number | null = null;

      switch (sortField) {
        case 'title':
          aValue = a.title?.toLowerCase() || '';
          bValue = b.title?.toLowerCase() || '';
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'priority':
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          aValue = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 99;
          bValue = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 99;
          break;
        case 'due_date':
          aValue = a.due_date || '';
          bValue = b.due_date || '';
          break;
        default:
          aValue = a.title?.toLowerCase() || '';
          bValue = b.title?.toLowerCase() || '';
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [tasks, searchTerm, statusFilter, hideCompleted, priorityFilter, assignedToFilter, sortField, sortDirection]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, priorityFilter, assignedToFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTasks = filteredTasks.slice(startIndex, startIndex + itemsPerPage);

  // Check if any filters are active (active tasks filter is the new default)
  const hasActiveFilters = searchTerm !== '' || 
    (statusFilter !== 'open,in_progress,cancelled' && statusFilter !== 'all') || 
    priorityFilter !== 'all' || 
    assignedToFilter !== 'all';

  const clearAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('open,in_progress,cancelled');
    setHideCompleted(true);
    setPriorityFilter('all');
    setAssignedToFilter('all');
  };

  // Generate initials from task title
  const getTaskInitials = (title: string) => {
    return title.split(' ').slice(0, 2).map(word => word.charAt(0).toUpperCase()).join('');
  };

  // Generate consistent vibrant color from title
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-600', 'bg-emerald-600', 'bg-purple-600', 'bg-amber-600', 
      'bg-rose-600', 'bg-cyan-600', 'bg-indigo-600', 'bg-teal-600'
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  const getDueDateInfo = (dueDate: string | null, status: string) => {
    if (!dueDate || status === 'completed' || status === 'cancelled') return { color: '', isOverdue: false, isDueToday: false };
    const date = new Date(dueDate);
    date.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isOverdue = date < today;
    const isDueToday = date.getTime() === today.getTime();
    if (isOverdue) return { color: 'text-red-600 font-semibold', isOverdue: true, isDueToday: false };
    if (isDueToday) return { color: 'text-orange-500 font-medium', isOverdue: false, isDueToday: true };
    return { color: '', isOverdue: false, isDueToday: false };
  };

  const handleDeleteClick = (task: Task) => {
    setTaskToDelete(task);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (taskToDelete) {
      onDelete(taskToDelete.id);
      setTaskToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const getLinkedEntityDisplay = (task: Task): { icon: React.ElementType; name: string } | null => {
    if (!task.module_type) return null;
    
    const Icon = moduleIcons[task.module_type] || FileText;
    
    switch (task.module_type) {
      case 'accounts':
        return task.account_name ? { icon: Icon, name: task.account_name } : null;
      case 'contacts':
        return task.contact_name ? { icon: Icon, name: task.contact_name } : null;
      case 'leads':
        return task.lead_name ? { icon: Icon, name: task.lead_name } : null;
      case 'meetings':
        return task.meeting_subject ? { icon: Icon, name: task.meeting_subject } : null;
      case 'deals':
        return task.deal_name ? { icon: Icon, name: task.deal_name } : null;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Filters */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select 
            value={statusFilter === 'open,in_progress,cancelled' ? 'active' : statusFilter} 
            onValueChange={(val) => {
              if (val === 'active') {
                setStatusFilter('open,in_progress,cancelled');
                setHideCompleted(true);
              } else if (val === 'all') {
                setStatusFilter('all');
                setHideCompleted(false);
              } else {
                setStatusFilter(val);
                setHideCompleted(false);
              }
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active Tasks</SelectItem>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={assignedToFilter} onValueChange={setAssignedToFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Assigned To" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assigned</SelectItem>
              {assignedToIds.map((userId) => (
                <SelectItem key={userId} value={userId}>
                  <span className="truncate">{displayNames[userId] || 'Loading...'}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <ClearFiltersButton hasActiveFilters={hasActiveFilters} onClear={clearAllFilters} />
        </div>

        {/* Page size selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Show:</span>
          <Select value={itemsPerPage.toString()} onValueChange={val => setItemsPerPage(Number(val))}>
            <SelectTrigger className="w-[70px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map(size => <SelectItem key={size} value={size.toString()}>{size}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Task Table */}
      <Card className="flex-1 min-h-0 flex flex-col">
        <div className="relative overflow-auto flex-1 min-h-0">
          <Table>
            <TableHeader>
              <TableRow className="sticky top-0 z-20 bg-muted border-b-2 shadow-sm">
                {visibleColumns.includes('checkbox') && (
                  <TableHead className="w-10 font-bold text-foreground bg-muted">
                    <Checkbox
                      checked={paginatedTasks.length > 0 && paginatedTasks.every(t => selectedTasks.includes(t.id))}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          const newSelected = [...new Set([...selectedTasks, ...paginatedTasks.map(t => t.id)])];
                          setSelectedTasks(newSelected);
                        } else {
                          const paginatedIds = paginatedTasks.map(t => t.id);
                          setSelectedTasks(selectedTasks.filter(id => !paginatedIds.includes(id)));
                        }
                      }}
                      aria-label="Select all on page"
                    />
                  </TableHead>
                )}
                {visibleColumns.includes('title') && (
                  <TableHead className="font-bold text-foreground px-4 py-3 bg-muted">Task</TableHead>
                )}
                {visibleColumns.includes('status') && (
                  <TableHead className="font-bold text-foreground px-4 py-3 bg-muted">Status</TableHead>
                )}
                {visibleColumns.includes('priority') && (
                  <TableHead className="font-bold text-foreground px-4 py-3 bg-muted">Priority</TableHead>
                )}
                {visibleColumns.includes('due_date') && (
                  <TableHead className="font-bold text-foreground px-4 py-3 bg-muted">Due Date</TableHead>
                )}
                {visibleColumns.includes('due_time') && (
                  <TableHead className="font-bold text-foreground px-4 py-3 bg-muted">Due Time</TableHead>
                )}
                {visibleColumns.includes('assigned_to') && (
                  <TableHead className="font-bold text-foreground px-4 py-3 bg-muted">Assigned To</TableHead>
                )}
                {visibleColumns.includes('linked_to') && (
                  <TableHead className="font-bold text-foreground px-4 py-3 bg-muted">Linked To</TableHead>
                )}
                {visibleColumns.includes('created_by') && (
                  <TableHead className="font-bold text-foreground px-4 py-3 bg-muted">Task Owner</TableHead>
                )}
                {visibleColumns.includes('module_type') && (
                  <TableHead className="font-bold text-foreground px-4 py-3 bg-muted">Module</TableHead>
                )}
                {visibleColumns.includes('description') && (
                  <TableHead className="font-bold text-foreground px-4 py-3 bg-muted">Description</TableHead>
                )}
                {visibleColumns.includes('created_at') && (
                  <TableHead className="font-bold text-foreground px-4 py-3 bg-muted">Created Date</TableHead>
                )}
                {visibleColumns.includes('actions') && (
                  <TableHead className="w-32 text-center font-bold text-foreground px-4 py-3 bg-muted">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length} className="text-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <ListTodo className="w-10 h-10 text-muted-foreground/50" />
                      <div>
                        <p className="font-medium text-foreground">No tasks found</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {hasActiveFilters ? "Try adjusting your search or filter criteria" : "Get started by adding your first task"}
                        </p>
                      </div>
                      {hasActiveFilters && (
                        <Button size="sm" variant="outline" onClick={clearAllFilters}>
                          Clear filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTasks.map((task) => {
                  const linkedEntity = getLinkedEntityDisplay(task);
                  const dueDateInfo = getDueDateInfo(task.due_date, task.status);

                  return (
                    <TableRow 
                      key={task.id} 
                      className={`hover:bg-muted/20 border-b group ${
                        task.status === 'completed' 
                          ? 'bg-emerald-50/50 dark:bg-emerald-900/10' 
                          : dueDateInfo.isOverdue 
                            ? 'bg-red-50 dark:bg-red-900/10' 
                            : ''
                      }`}
                    >
                      {visibleColumns.includes('checkbox') && (
                        <TableCell className="px-4 py-3">
                          <Checkbox
                            checked={selectedTasks.includes(task.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedTasks([...selectedTasks, task.id]);
                              } else {
                                setSelectedTasks(selectedTasks.filter(id => id !== task.id));
                              }
                            }}
                            aria-label={`Select ${task.title}`}
                          />
                        </TableCell>
                      )}
                      {visibleColumns.includes('title') && (
                        <TableCell className="px-4 py-3">
                          <button
                            onClick={() => setViewingTask(task)}
                            className={`text-primary hover:underline font-medium text-left truncate ${
                              task.status === 'completed' ? 'text-muted-foreground' : ''
                            }`}
                          >
                            <HighlightedText text={task.title} highlight={searchTerm} />
                          </button>
                        </TableCell>
                      )}
                      {visibleColumns.includes('status') && (
                        <TableCell className="px-4 py-3">
                          <Badge variant="outline" className={`whitespace-nowrap ${getTaskStatusColor(task.status)}`}>
                            {getTaskStatusLabel(task.status)}
                          </Badge>
                        </TableCell>
                      )}
                      {visibleColumns.includes('priority') && (
                        <TableCell className="px-4 py-3">
                          <Badge variant="outline" className={`whitespace-nowrap capitalize ${getTaskPriorityColor(task.priority)}`}>
                            {task.priority}
                          </Badge>
                        </TableCell>
                      )}
                      {visibleColumns.includes('due_date') && (
                        <TableCell className="px-4 py-3">
                          {task.due_date ? (
                            <div className="flex items-center gap-1">
                              {dueDateInfo.isOverdue && <AlertCircle className="h-3 w-3 text-red-600" />}
                              <span className={dueDateInfo.color}>
                                {dueDateInfo.isOverdue ? 'OVERDUE - ' : dueDateInfo.isDueToday ? 'Today - ' : ''}
                                {format(new Date(task.due_date), 'dd/MM/yyyy')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-center text-muted-foreground w-full block">-</span>
                          )}
                        </TableCell>
                      )}
                      {visibleColumns.includes('due_time') && (
                        <TableCell className="px-4 py-3">
                          <span className="text-sm">{task.due_time || '-'}</span>
                        </TableCell>
                      )}
                      {visibleColumns.includes('assigned_to') && (
                        <TableCell className="px-4 py-3">
                          <span className="truncate block">
                            {task.assigned_to ? (displayNames[task.assigned_to] || 'Loading...') : <span className="text-muted-foreground">Unassigned</span>}
                          </span>
                        </TableCell>
                      )}
                      {visibleColumns.includes('linked_to') && (
                        <TableCell className="px-4 py-3">
                          {linkedEntity && task.module_type ? (
                            <button
                              onClick={() => {
                                const recordId = task.account_id || task.contact_id || task.lead_id || task.meeting_id || task.deal_id;
                                if (recordId && task.module_type) {
                                  navigate(`${moduleRoutes[task.module_type]}?viewId=${recordId}`);
                                }
                              }}
                              className="flex items-center gap-1.5 text-sm text-primary hover:underline group"
                            >
                              <Badge variant="outline" className={`${getModuleTypeColor(task.module_type)} capitalize gap-1`}>
                                <linkedEntity.icon className="h-3 w-3" />
                                <span className="truncate max-w-[80px]" title={linkedEntity.name}>
                                  {linkedEntity.name}
                                </span>
                              </Badge>
                              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ) : (
                            <span className="text-center text-muted-foreground w-full block">-</span>
                          )}
                        </TableCell>
                      )}
                      {visibleColumns.includes('created_by') && (
                        <TableCell className="px-4 py-3">
                          {task.created_by ? (
                            <div className="flex items-center gap-1 text-sm">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="truncate max-w-[100px]" title={displayNames[task.created_by]}>
                                {displayNames[task.created_by] || 'Loading...'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-center text-muted-foreground w-full block">-</span>
                          )}
                        </TableCell>
                      )}
                      {visibleColumns.includes('module_type') && (
                        <TableCell className="px-4 py-3">
                          {task.module_type ? (
                            <Badge variant="outline" className={`${getModuleTypeColor(task.module_type)} capitalize`}>
                              {task.module_type}
                            </Badge>
                          ) : (
                            <span className="text-center text-muted-foreground w-full block">-</span>
                          )}
                        </TableCell>
                      )}
                      {visibleColumns.includes('description') && (
                        <TableCell className="px-4 py-3">
                          <span className="truncate block max-w-[200px]" title={task.description || ''}>
                            {task.description || '-'}
                          </span>
                        </TableCell>
                      )}
                      {visibleColumns.includes('created_at') && (
                        <TableCell className="px-4 py-3">
                          {task.created_at ? format(new Date(task.created_at), 'dd/MM/yyyy') : '-'}
                        </TableCell>
                      )}
                      {visibleColumns.includes('actions') && (
                        <TableCell className="w-20 px-4 py-3">
                          <div className="flex items-center justify-center">
                            <RowActionsDropdown
                              actions={[
                                {
                                  label: "View Details",
                                  icon: <Eye className="w-4 h-4" />,
                                  onClick: () => setViewingTask(task)
                                },
                                {
                                  label: "Edit",
                                  icon: <Edit className="w-4 h-4" />,
                                  onClick: () => onEdit(task)
                                },
                                {
                                  label: "Delete",
                                  icon: <Trash2 className="w-4 h-4" />,
                                  onClick: () => handleDeleteClick(task),
                                  destructive: true,
                                  separator: true
                                }
                              ]}
                            />
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              Showing {filteredTasks.length === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredTasks.length)} of {filteredTasks.length} tasks
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage(1)} 
              disabled={currentPage === 1}
              className="hidden sm:flex"
              aria-label="Go to first page"
            >
              <ChevronLeft className="w-4 h-4" />
              <ChevronLeft className="w-4 h-4 -ml-2" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
              disabled={currentPage === 1}
              aria-label="Go to previous page"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Previous</span>
            </Button>
            <span className="text-sm px-3 py-1 bg-muted rounded-md font-medium">
              Page {currentPage} of {totalPages || 1}
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
              disabled={currentPage === totalPages || totalPages === 0}
              aria-label="Go to next page"
            >
              <span className="hidden sm:inline mr-1">Next</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage(totalPages)} 
              disabled={currentPage === totalPages || totalPages === 0}
              className="hidden sm:flex"
              aria-label="Go to last page"
            >
              <ChevronRight className="w-4 h-4" />
              <ChevronRight className="w-4 h-4 -ml-2" />
            </Button>
          </div>
        </div>
      </Card>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        itemName={taskToDelete?.title}
        itemType="task"
      />

      <TaskDetailModal
        open={!!viewingTask}
        onOpenChange={(open) => !open && setViewingTask(null)}
        task={viewingTask}
        onEdit={(task) => {
          setViewingTask(null);
          onEdit(task);
        }}
      />
    </div>
  );
};