import { Bell, CheckCheck, Trash2, MoreVertical, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { NotificationStatusFilter } from '@/components/notifications/NotificationStatusFilter';
import { NotificationTypeFilter } from '@/components/notifications/NotificationTypeFilter';
import { NotificationDateFilter } from '@/components/notifications/NotificationDateFilter';
import { NotificationDeleteConfirmDialog } from '@/components/notifications/NotificationDeleteConfirmDialog';
import { ClearFiltersButton } from '@/components/shared/ClearFiltersButton';
import { TablePagination } from '@/components/shared/TablePagination';

const Notifications = () => {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead,
    bulkMarkAsRead,
    deleteNotification,
    bulkDelete,
    clearAllRead,
    loading,
    currentPage,
    totalNotifications,
    itemsPerPage,
    setItemsPerPage,
    filters,
    updateFilters,
    clearFilters,
    hasActiveFilters,
    setCurrentPage
  } = useNotifications();
  const navigate = useNavigate();
  
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);

  const totalPages = Math.ceil(totalNotifications / itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedNotifications([]);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedNotifications(notifications.map(n => n.id));
    } else {
      setSelectedNotifications([]);
    }
  };

  const handleSelectNotification = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedNotifications(prev => [...prev, id]);
    } else {
      setSelectedNotifications(prev => prev.filter(nId => nId !== id));
    }
  };

  const handleBulkMarkAsRead = async () => {
    if (selectedNotifications.length > 0) {
      await bulkMarkAsRead(selectedNotifications);
      setSelectedNotifications([]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedNotifications.length > 0) {
      await bulkDelete(selectedNotifications);
      setSelectedNotifications([]);
      setShowDeleteDialog(false);
    }
  };

  const handleClearAllRead = async () => {
    await clearAllRead();
    setShowClearAllDialog(false);
  };

  const handleNotificationClick = async (notification: any) => {
    if (notification.status === 'unread') {
      await markAsRead(notification.id);
    }

    const message = notification.message.toLowerCase();
    const dealMatch = message.match(/deal[:\s]+([a-f0-9-]{36})/);
    const leadMatch = message.match(/lead[:\s]+([a-f0-9-]{36})/);
    
    const taskNotificationTypes = [
      'task_assigned', 'task_unassigned', 'task_completed', 
      'task_updated', 'task_deleted'
    ];
    
    if (taskNotificationTypes.includes(notification.notification_type)) {
      navigate('/tasks');
    } else if (notification.lead_id) {
      navigate(`/leads?viewId=${notification.lead_id}`);
    } else if (dealMatch) {
      const dealId = dealMatch[1];
      navigate(`/deals?viewId=${dealId}`);
    } else if (leadMatch) {
      const leadId = leadMatch[1];
      navigate(`/leads?viewId=${leadId}`);
    } else if (notification.notification_type === 'deal_update') {
      navigate('/deals');
    } else if (notification.notification_type === 'lead_update') {
      navigate('/leads');
    } else {
      navigate('/dashboard');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'lead_update':
        return '👤';
      case 'deal_update':
        return '💼';
      case 'task_assigned':
        return '✅';
      case 'task_unassigned':
        return '📤';
      case 'task_completed':
        return '🎉';
      case 'task_updated':
        return '📝';
      case 'task_deleted':
        return '🗑️';
      default:
        return '🔔';
    }
  };

  const showSkeleton = loading && notifications.length === 0;
  const allSelected = notifications.length > 0 && selectedNotifications.length === notifications.length;
  const someSelected = selectedNotifications.length > 0 && selectedNotifications.length < notifications.length;

  // Pagination display values
  const startItem = totalNotifications === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalNotifications);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Fixed Header */}
      <div className="flex-shrink-0 bg-background">
        <div className="px-6 h-16 flex items-center border-b w-full">
          <div className="flex items-center justify-between w-full">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold text-foreground">Notifications</h1>
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="rounded-full">
                    {unreadCount} unread
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {selectedNotifications.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleBulkMarkAsRead}>
                    <CheckCheck className="w-4 h-4 mr-2" />
                    Mark Read ({selectedNotifications.length})
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete ({selectedNotifications.length})
                  </Button>
                </div>
              )}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={markAllAsRead} disabled={unreadCount === 0}>
                    <CheckCheck className="w-4 h-4 mr-2" />
                    Mark All as Read
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => setShowClearAllDialog(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear All Read
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-6 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search notifications..."
                value={filters.searchTerm}
                onChange={(e) => updateFilters({ searchTerm: e.target.value })}
                className="pl-9 h-9"
              />
              {filters.searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => updateFilters({ searchTerm: '' })}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            
            <NotificationStatusFilter
              value={filters.statusFilter}
              onValueChange={(value) => updateFilters({ statusFilter: value as any })}
            />
            
            <NotificationTypeFilter
              value={filters.typeFilter}
              onValueChange={(value) => updateFilters({ typeFilter: value })}
            />
            
            <NotificationDateFilter
              value={filters.dateFilter}
              onValueChange={(value) => updateFilters({ dateFilter: value as any })}
            />
            
            <ClearFiltersButton 
              hasActiveFilters={hasActiveFilters}
              onClear={clearFilters} 
            />
            
            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Show:</span>
              <Select
                value={itemsPerPage.toString()}
                onValueChange={(value) => setItemsPerPage(Number(value))}
              >
                <SelectTrigger className="w-20 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {showSkeleton ? (
          <div className="space-y-4 p-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <Bell className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold mb-2">
                {hasActiveFilters ? 'No notifications match your filters' : 'No notifications yet'}
              </h3>
              <p className="text-sm">
                {hasActiveFilters 
                  ? 'Try adjusting your filters to see more results' 
                  : "You'll see updates about tasks and records here"}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full overflow-auto">
            {/* Select All Header */}
            <div className="px-6 py-3 border-b bg-muted/20 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all notifications"
                  className={someSelected ? 'data-[state=checked]:bg-primary/50' : ''}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedNotifications.length > 0 
                    ? `${selectedNotifications.length} selected` 
                    : 'Select all'}
                </span>
              </div>
            </div>
            
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "px-6 py-4 hover:bg-muted/50 transition-colors relative group",
                    notification.status === 'unread' && "bg-primary/5 border-l-4 border-l-primary",
                    selectedNotifications.includes(notification.id) && "bg-muted/50"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={selectedNotifications.includes(notification.id)}
                      onCheckedChange={(checked) => handleSelectNotification(notification.id, !!checked)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1"
                    />
                    
                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xl flex-shrink-0">
                          {getNotificationIcon(notification.notification_type)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm text-foreground leading-relaxed mb-2",
                            notification.status === 'unread' && "font-semibold"
                          )}>
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                            </span>
                            {notification.status === 'unread' && (
                              <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                                New
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs capitalize">
                              {notification.notification_type.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {notification.status === 'unread' && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                          >
                            <CheckCheck className="h-4 w-4 mr-2" />
                            Mark as read
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {totalNotifications > 0 && (
        <div className="flex-shrink-0 border-t bg-background">
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            totalItems={totalNotifications}
            onPageChange={handlePageChange}
            entityName="notifications"
          />
        </div>
      )}

      {/* Delete Confirmation Dialogs */}
      <NotificationDeleteConfirmDialog
        open={showDeleteDialog}
        onConfirm={handleBulkDelete}
        onCancel={() => setShowDeleteDialog(false)}
        count={selectedNotifications.length}
      />
      
      <NotificationDeleteConfirmDialog
        open={showClearAllDialog}
        onConfirm={handleClearAllRead}
        onCancel={() => setShowClearAllDialog(false)}
        isClearAll
      />
    </div>
  );
};

export default Notifications;
