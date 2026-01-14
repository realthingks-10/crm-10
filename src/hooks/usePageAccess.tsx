import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/contexts/PermissionsContext';

interface PagePermission {
  id: string;
  page_name: string;
  route: string;
  admin_access: boolean;
  manager_access: boolean;
  user_access: boolean;
}

/**
 * @deprecated Use usePermissions().hasPageAccess(route) instead for better performance.
 * This hook is kept for backward compatibility with existing components.
 */
export const usePageAccess = (route: string) => {
  const { hasPageAccess, loading } = usePermissions();
  
  const hasAccess = hasPageAccess(route);

  return { hasAccess, loading, refetch: () => {} };
};

export const useAllPagePermissions = () => {
  const [permissions, setPermissions] = useState<PagePermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const { data, error } = await supabase
          .from('page_permissions')
          .select('*');

        if (error) throw error;
        setPermissions(data || []);
      } catch (error) {
        console.error('Error fetching page permissions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, []);

  return { permissions, loading };
};
