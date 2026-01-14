import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/contexts/PermissionsContext';
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
  const { user, loading: authLoading } = useAuth();
  const { userRole, isAdmin, loading: permissionsLoading } = usePermissions();
  
  // Refs to prevent duplicate session logging
  const sessionLoggedRef = useRef<string | null>(null);
  const visibilityHandlerRef = useRef<(() => void) | null>(null);

  const hasAdminAccess = isAdmin;

  // Inline security event logging to avoid circular dependency
  const logSecurityEvent = useCallback((
    action: string,
    resourceType: string,
    resourceId?: string,
    details?: Record<string, unknown>
  ) => {
    if (!user) return;
    
    // Fire and forget - don't block rendering
    supabase.rpc('log_security_event', {
      p_action: action,
      p_resource_type: resourceType,
      p_resource_id: resourceId,
      p_details: details as unknown as Record<string, never>
    }).then(({ error }) => {
      if (error) console.error('Failed to log security event:', error);
    });
  }, [user]);

  // Debounced visibility change handler
  const handleVisibilityChange = useCallback(() => {
    if (!user) return;
    if (document.hidden) {
      logSecurityEvent('SESSION_INACTIVE', 'auth', user.id);
    } else {
      logSecurityEvent('SESSION_ACTIVE', 'auth', user.id);
    }
  }, [user, logSecurityEvent]);

  useEffect(() => {
    // Don't do anything while still loading auth
    if (authLoading || permissionsLoading) return;
    
    if (!user || !userRole) {
      // Clean up if user logs out
      if (visibilityHandlerRef.current) {
        document.removeEventListener('visibilitychange', visibilityHandlerRef.current);
        visibilityHandlerRef.current = null;
      }
      sessionLoggedRef.current = null;
      return;
    }

    // Only log session start once per user session
    const sessionKey = `${user.id}-${userRole}`;
    if (sessionLoggedRef.current !== sessionKey) {
      sessionLoggedRef.current = sessionKey;
      logSecurityEvent('SESSION_START', 'auth', user.id, {
        login_time: new Date().toISOString(),
        user_agent: navigator.userAgent,
        role: userRole,
        user_email: user.email
      });
    }

    // Set up visibility handler only once
    if (!visibilityHandlerRef.current) {
      visibilityHandlerRef.current = handleVisibilityChange;
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      if (visibilityHandlerRef.current) {
        document.removeEventListener('visibilitychange', visibilityHandlerRef.current);
        visibilityHandlerRef.current = null;
      }
    };
  }, [user, userRole, authLoading, permissionsLoading, logSecurityEvent, handleVisibilityChange]);

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
