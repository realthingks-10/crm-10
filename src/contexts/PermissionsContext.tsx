import React, { createContext, useContext, useCallback, useMemo, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface PagePermission {
  id: string;
  page_name: string;
  route: string;
  admin_access: boolean;
  manager_access: boolean;
  user_access: boolean;
}

interface AccessSnapshot {
  role: string;
  permissions: PagePermission[];
  profile: {
    id?: string;
    full_name?: string;
    email?: string;
    avatar_url?: string;
    phone?: string;
    timezone?: string;
  };
  computed_at: string;
}

interface PermissionsContextType {
  userRole: string;
  isAdmin: boolean;
  isManager: boolean;
  permissions: PagePermission[];
  loading: boolean;
  hasPageAccess: (route: string) => boolean;
  refreshPermissions: () => Promise<void>;
  userProfile: AccessSnapshot['profile'] | null;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within PermissionsProvider');
  }
  return context;
};

interface PermissionsProviderProps {
  children: React.ReactNode;
}

// Default snapshot to use as fallback
const DEFAULT_SNAPSHOT: AccessSnapshot = {
  role: 'user',
  permissions: [],
  profile: {},
  computed_at: new Date().toISOString()
};

export const PermissionsProvider = ({ children }: PermissionsProviderProps) => {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  // Use React Query with the new RPC for access snapshot
  // 24 hour staleTime - the RPC handles version checking internally
  const { data: snapshot, isLoading: snapshotLoading, error: snapshotError } = useQuery({
    queryKey: ['access-snapshot', user?.id],
    queryFn: async () => {
      // Add a timeout wrapper to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Snapshot fetch timeout')), 10000);
      });

      const fetchPromise = (async () => {
        const { data, error } = await supabase.rpc('get_my_access_snapshot');
        
        if (error) {
          console.error('Error fetching access snapshot:', error);
          return DEFAULT_SNAPSHOT;
        }

        // RPC returns an array with one row
        const result = data?.[0];
        if (!result) {
          return DEFAULT_SNAPSHOT;
        }

        return {
          role: result.role || 'user',
          permissions: Array.isArray(result.permissions) ? (result.permissions as unknown as PagePermission[]) : [],
          profile: (result.profile || {}) as AccessSnapshot['profile'],
          computed_at: result.computed_at
        } as AccessSnapshot;
      })();

      try {
        return await Promise.race([fetchPromise, timeoutPromise]);
      } catch (error) {
        console.error('Access snapshot fetch failed or timed out:', error);
        return DEFAULT_SNAPSHOT;
      }
    },
    enabled: !!user,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - RPC handles version invalidation
    gcTime: 24 * 60 * 60 * 1000, // Keep in cache for 24 hours
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  });

  // Safety timeout: if loading takes more than 8 seconds, stop showing loading state
  useEffect(() => {
    if (!authLoading && snapshotLoading && user) {
      const timer = setTimeout(() => {
        console.warn('Permissions loading timed out, using defaults');
        setLoadingTimedOut(true);
      }, 8000);
      
      return () => clearTimeout(timer);
    } else {
      setLoadingTimedOut(false);
    }
  }, [authLoading, snapshotLoading, user]);

  const userRole = snapshot?.role || 'user';
  const permissions = snapshot?.permissions || [];
  const userProfile = snapshot?.profile || null;

  const refreshPermissions = useCallback(async () => {
    // Invalidate the access snapshot query to force refetch
    await queryClient.invalidateQueries({ queryKey: ['access-snapshot', user?.id] });
  }, [queryClient, user?.id]);

  const hasPageAccess = useCallback((route: string): boolean => {
    // Normalize route
    const normalizedRoute = route === '/' ? '/dashboard' : route.replace(/\/$/, '');
    
    // Find permission for this route
    const permission = permissions.find(p => p.route === normalizedRoute);
    
    // If no permission record exists, allow access by default
    if (!permission) {
      return true;
    }

    // Check access based on role
    switch (userRole) {
      case 'admin':
        return permission.admin_access;
      case 'manager':
        return permission.manager_access;
      case 'user':
      default:
        return permission.user_access;
    }
  }, [permissions, userRole]);

  const isAdmin = userRole === 'admin';
  const isManager = userRole === 'manager';

  // Only show loading on initial load when there's no cached data
  // Also respect the timeout to prevent infinite loading
  const loading = authLoading || (snapshotLoading && !snapshot && !loadingTimedOut);

  const value = useMemo(() => ({
    userRole,
    isAdmin,
    isManager,
    permissions,
    loading,
    hasPageAccess,
    refreshPermissions,
    userProfile
  }), [userRole, isAdmin, isManager, permissions, loading, hasPageAccess, refreshPermissions, userProfile]);

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
};
