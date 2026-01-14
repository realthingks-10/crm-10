import { useState, useRef, useEffect } from 'react';
import { Bell, X, MoreVertical, Trash2, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface NotificationBellProps { 
  placement?: 'up' | 'down'
  size?: 'small' | 'large'
}

export const NotificationBell = ({ placement = 'down', size = 'large' }: NotificationBellProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notification: any) => {
    // Mark as read first
    if (notification.status === 'unread') {
      await markAsRead(notification.id);
    }

    // Parse the notification message to extract IDs and navigate accordingly
    const message = notification.message.toLowerCase();
    
    // Check for deal references in the message
    const dealMatch = message.match(/deal[:\s]+([a-f0-9-]{36})/);
    const leadMatch = message.match(/lead[:\s]+([a-f0-9-]{36})/);
    
    // Navigate based on the notification content and available IDs
    if (notification.lead_id) {
      // Direct lead ID available, navigate to leads page
      navigate(`/leads?highlight=${notification.lead_id}`);
    } else if (dealMatch) {
      // Deal ID found in message, navigate to deals page
      const dealId = dealMatch[1];
      navigate(`/deals?highlight=${dealId}`);
    } else if (leadMatch) {
      // Lead ID found in message, navigate to leads page  
      const leadId = leadMatch[1];
      navigate(`/leads?highlight=${leadId}`);
    } else if (notification.notification_type === 'action_item') {
      // Action item notification - try to determine context
      if (message.includes('deal')) {
        navigate('/deals');
      } else if (message.includes('lead') || message.includes('contact')) {
        navigate('/leads');
      } else {
        // Default to deals page for action items
        navigate('/deals');
      }
    } else if (notification.notification_type === 'deal_update') {
      navigate('/deals');
    } else if (notification.notification_type === 'lead_update') {
      navigate('/leads');
    } else {
      // Default navigation
      navigate('/dashboard');
    }
    
    setIsOpen(false);
  };

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await markAllAsRead();
  };

  const handleDeleteNotification = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    await deleteNotification(notificationId);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'action_item':
        return '📋';
      case 'lead_update':
        return '👤';
      case 'deal_update':
        return '💼';
      default:
        return '🔔';
    }
  };

  return (
    <div className="relative" ref={dropdownRef} style={{ zIndex: 9999 }}>
      {/* Bell Icon Button */}
      <Button
        variant="outline"
        size={size === 'small' ? 'sm' : 'lg'}
        className={`relative p-0 bg-background hover:bg-accent rounded-full border-2 border-border hover:border-primary/50 shadow-md hover:shadow-lg transition-all duration-200 ${
          size === 'small' ? 'h-8 w-8' : 'h-12 w-12'
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className={`text-muted-foreground hover:text-primary transition-colors ${
          size === 'small' ? 'h-4 w-4' : 'h-6 w-6'
        }`} />
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className={`absolute rounded-full p-0 flex items-center justify-center text-xs font-bold bg-red-500 text-white border-2 border-white shadow-lg animate-pulse ${
              size === 'small' 
                ? '-top-1 -right-1 h-5 w-5 text-[10px]' 
                : '-top-2 -right-2 h-6 w-6 text-xs'
            }`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Notifications Dropdown */}
      {isOpen && (
        <div 
          className={`absolute right-0 ${placement === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'} w-96 bg-popover rounded-lg shadow-xl border border-border`}
          style={{ 
            zIndex: 10000
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-muted/50 rounded-t-lg">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllRead}
                  className="text-xs text-primary hover:text-primary/80 hover:bg-primary/10"
                >
                  <CheckCheck className="h-4 w-4 mr-1" />
                  Mark all read
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-6 w-6 p-0 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Notifications List */}
          <ScrollArea className="max-h-96">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-sm">No notifications yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">You'll see updates about action items here</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      "p-4 hover:bg-accent cursor-pointer transition-colors relative group",
                      notification.status === 'unread' && "bg-primary/5 border-l-4 border-l-primary"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-3">
                          <span className="text-lg mt-0.5">
                            {getNotificationIcon(notification.notification_type)}
                          </span>
                          <div className="flex-1">
                            <p className={cn(
                              "text-sm text-foreground leading-relaxed",
                              notification.status === 'unread' && "font-semibold"
                            )}>
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                              </p>
                              {notification.status === 'unread' && (
                                <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                                  New
                                </Badge>
                              )}
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
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
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
                              Mark as read
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => handleDeleteNotification(e, notification.id)}
                            className="text-red-600"
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
            )}
          </ScrollArea>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-border text-center bg-muted/50 rounded-b-lg">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-primary hover:text-primary/80 hover:bg-primary/10"
                onClick={() => {
                  setIsOpen(false);
                  navigate('/notifications');
                }}
              >
                View all notifications
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
