
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSecurityAudit } from '@/hooks/useSecurityAudit';
import { supabase } from '@/integrations/supabase/client';

interface SecurityContextType {
  isSecurityEnabled: boolean;
  hasAdminAccess: boolean;
  userRole: string | null;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export const useSecurityContext = () => {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurityContext must be used within SecurityProvider');
  }
  return context;
};

interface SecurityProviderProps {
  children: React.ReactNode;
}

export const SecurityProvider = ({ children }: SecurityProviderProps) => {
  const { user } = useAuth();
  const { logSecurityEvent } = useSecurityAudit();
  const [userRole, setUserRole] = useState<string | null>(null);

  const hasAdminAccess = userRole === 'admin';

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        setUserRole(null);
        return;
      }

      try {
        // Check user metadata first for role
        const metadataRole = user.user_metadata?.role;
        if (metadataRole) {
          setUserRole(metadataRole);
          console.log('User role from metadata:', metadataRole);
          return;
        }

        // Fallback to database lookup
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 means no rows returned
          console.error('Error fetching user role:', error);
          setUserRole('user'); // Default fallback
          return;
        }

        const role = data?.role || 'user';
        setUserRole(role);
        console.log('User role from database:', role);
      } catch (error) {
        console.error('Failed to fetch user role:', error);
        setUserRole('user');
      }
    };

    fetchUserRole();
  }, [user]);

  useEffect(() => {
    if (user && userRole) {
      // Log user session start
      logSecurityEvent('SESSION_START', 'auth', user.id, {
        login_time: new Date().toISOString(),
        user_agent: navigator.userAgent,
        role: userRole,
        user_email: user.email
      });

      // Set up session monitoring
      const handleVisibilityChange = () => {
        if (document.hidden) {
          logSecurityEvent('SESSION_INACTIVE', 'auth', user.id);
        } else {
          logSecurityEvent('SESSION_ACTIVE', 'auth', user.id);
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        logSecurityEvent('SESSION_END', 'auth', user.id);
      };
    }
  }, [user, userRole, logSecurityEvent]);

  const value = {
    isSecurityEnabled: true,
    hasAdminAccess,
    userRole
  };

  return (
    <SecurityContext.Provider value={value}>
      {children}
    </SecurityContext.Provider>
  );
};
