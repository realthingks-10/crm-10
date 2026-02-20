
import React from 'react';
import { 
  Home, 
  Users, 
  Briefcase, 
  UserPlus, 
  Settings, 
  Bell,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar/SidebarProvider';
import { NotificationBell } from '@/components/NotificationBell';

const CrmSidebar = () => {
  const location = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const menuItems = [
    { icon: Home, label: 'Dashboard', path: '/dashboard' },
    { icon: Users, label: 'Contacts', path: '/contacts' },
    { icon: Briefcase, label: 'Deals', path: '/deals' },
    { icon: UserPlus, label: 'Leads', path: '/leads' },
    { icon: Bell, label: 'Notifications', path: '/notifications' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <div className={`bg-sidebar border-r border-border h-full flex flex-col transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-64'
    }`}>
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        {!isCollapsed && (
          <h1 className="text-xl font-bold text-foreground">CRM</h1>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="h-8 w-8 p-0"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
                  }`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!isCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Notification Bell - Fixed position */}
      {!isCollapsed && (
        <div className="p-4 border-t border-border">
          <div className="flex justify-center">
            <NotificationBell placement="up" size="large" />
          </div>
        </div>
      )}
    </div>
  );
};

export default CrmSidebar;
