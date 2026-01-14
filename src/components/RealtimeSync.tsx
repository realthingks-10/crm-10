import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Tables to monitor for realtime changes
const MONITORED_TABLES = ['accounts', 'contacts', 'leads', 'deals', 'meetings', 'tasks'] as const;
type MonitoredTable = typeof MONITORED_TABLES[number];

// Map of table names to their query keys
const TABLE_QUERY_KEYS: Record<MonitoredTable, string[][]> = {
  accounts: [['accounts']],
  contacts: [['contacts'], ['accounts']], // Also invalidate accounts for counts
  leads: [['leads'], ['accounts']], // Also invalidate accounts for counts
  deals: [['deals'], ['accounts']], // Also invalidate accounts for counts
  meetings: [['meetings']],
  tasks: [['tasks']], // Will use exact: false to match ['tasks', userId]
};

/**
 * RealtimeSync - Global component that listens to Supabase realtime changes
 * and invalidates React Query caches so all users see updates automatically.
 * 
 * This component should be mounted once for authenticated users.
 */
export const RealtimeSync = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const pendingInvalidations = useRef<Set<string>>(new Set());
  const throttleTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) return;

    console.log('[RealtimeSync] Setting up realtime subscriptions for CRM tables');

    // Throttled invalidation to batch rapid changes (e.g., during imports)
    const scheduleInvalidation = (table: MonitoredTable) => {
      pendingInvalidations.current.add(table);
      
      if (throttleTimer.current) return;
      
      throttleTimer.current = setTimeout(() => {
        const tablesToInvalidate = new Set(pendingInvalidations.current);
        pendingInvalidations.current.clear();
        throttleTimer.current = null;

        // Collect all unique query keys to invalidate
        const keysToInvalidate = new Set<string>();
        
        tablesToInvalidate.forEach(t => {
          const keys = TABLE_QUERY_KEYS[t as MonitoredTable];
          keys.forEach(key => keysToInvalidate.add(JSON.stringify(key)));
        });

        console.log('[RealtimeSync] Invalidating queries for tables:', Array.from(tablesToInvalidate));
        
        keysToInvalidate.forEach(keyStr => {
          const key = JSON.parse(keyStr);
          queryClient.invalidateQueries({ 
            queryKey: key,
            exact: false // Match all queries starting with this key
          });
        });
      }, 500); // 500ms throttle window
    };

    // Create a single channel for all CRM table changes
    const channel = supabase
      .channel('crm-realtime-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'accounts' },
        () => scheduleInvalidation('accounts')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contacts' },
        () => scheduleInvalidation('contacts')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => scheduleInvalidation('leads')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deals' },
        () => scheduleInvalidation('deals')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meetings' },
        () => scheduleInvalidation('meetings')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => scheduleInvalidation('tasks')
      )
      .subscribe((status) => {
        console.log('[RealtimeSync] Channel status:', status);
      });

    return () => {
      console.log('[RealtimeSync] Cleaning up realtime subscriptions');
      if (throttleTimer.current) {
        clearTimeout(throttleTimer.current);
      }
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  // This component doesn't render anything
  return null;
};

export default RealtimeSync;
