import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const BOUNCE_CHECK_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
const LOCAL_STORAGE_KEY = 'lastBounceCheckTime';
const MIN_TIME_BETWEEN_CHECKS_MS = 2 * 60 * 1000; // 2 minutes minimum between checks

/**
 * Background worker component that automatically checks for email bounces.
 * Runs every 3 minutes when the user is authenticated.
 * Uses localStorage to coordinate between tabs and avoid duplicate calls.
 */
export const BounceCheckWorker = () => {
  const { user } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(false);

  const runBounceCheck = useCallback(async () => {
    // Prevent concurrent runs
    if (isRunningRef.current || !user) return;
    
    // Check if another tab ran this recently
    const lastCheck = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (lastCheck) {
      const lastCheckTime = parseInt(lastCheck, 10);
      const now = Date.now();
      if (now - lastCheckTime < MIN_TIME_BETWEEN_CHECKS_MS) {
        console.log('[BounceCheckWorker] Skipping - another tab ran recently');
        return;
      }
    }
    
    isRunningRef.current = true;
    localStorage.setItem(LOCAL_STORAGE_KEY, Date.now().toString());
    
    try {
      console.log('[BounceCheckWorker] Running background checks...');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.log('[BounceCheckWorker] No session, skipping');
        return;
      }
      
      // Check for bounces
      const { data: bounceData, error: bounceError } = await supabase.functions.invoke('process-bounce-checks', {
        body: {},
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (bounceError) {
        console.warn('[BounceCheckWorker] Bounce check error:', bounceError.message);
      } else if (bounceData?.totalBouncesFound > 0) {
        console.log(`[BounceCheckWorker] Found ${bounceData.totalBouncesFound} bounce(s)`);
      }
      
      // Check for email replies
      const { data: replyData, error: replyError } = await supabase.functions.invoke('process-email-replies', {
        body: {},
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (replyError) {
        console.warn('[BounceCheckWorker] Reply check error:', replyError.message);
      } else if (replyData?.repliesFound > 0) {
        console.log(`[BounceCheckWorker] Found ${replyData.repliesFound} reply(s)`);
      }
      
      if (!bounceData?.totalBouncesFound && !replyData?.repliesFound) {
        console.log('[BounceCheckWorker] No new bounces or replies detected');
      }
    } catch (error) {
      console.warn('[BounceCheckWorker] Failed to run checks:', error);
    } finally {
      isRunningRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      // Clear interval if user logs out
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Run initial check after a short delay (to avoid running immediately on page load)
    const initialTimeout = setTimeout(() => {
      runBounceCheck();
    }, 10000); // 10 seconds after mount

    // Set up recurring interval
    intervalRef.current = setInterval(() => {
      runBounceCheck();
    }, BOUNCE_CHECK_INTERVAL_MS);

    // Also run on visibility change (when user comes back to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runBounceCheck();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, runBounceCheck]);

  // This component doesn't render anything
  return null;
};
