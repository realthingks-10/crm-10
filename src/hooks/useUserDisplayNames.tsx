import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// LocalStorage cache key
const CACHE_KEY = 'user_display_names_cache';
const CACHE_EXPIRY_KEY = 'user_display_names_expiry';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Create a global in-memory cache
const displayNameCache = new Map<string, string>();

// Track pending requests to prevent duplicate fetches
const pendingRequests = new Map<string, Promise<Record<string, string>>>();

// Load cache from localStorage on module init
const loadCacheFromStorage = () => {
  try {
    const expiry = localStorage.getItem(CACHE_EXPIRY_KEY);
    if (expiry && Date.now() > parseInt(expiry)) {
      // Cache expired, clear it
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_EXPIRY_KEY);
      return;
    }
    
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      Object.entries(parsed).forEach(([id, name]) => {
        displayNameCache.set(id, name as string);
      });
    }
  } catch (e) {
    // Silently fail - localStorage might not be available
  }
};

// Save cache to localStorage
const saveCacheToStorage = () => {
  try {
    const cacheObj: Record<string, string> = {};
    displayNameCache.forEach((name, id) => {
      cacheObj[id] = name;
    });
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheObj));
    localStorage.setItem(CACHE_EXPIRY_KEY, (Date.now() + CACHE_TTL).toString());
  } catch (e) {
    // Silently fail
  }
};

// Initialize cache from localStorage
loadCacheFromStorage();

// Batch fetch function with deduplication
const fetchDisplayNamesForIds = async (userIds: string[]): Promise<Record<string, string>> => {
  // Create a cache key for this batch
  const batchKey = [...userIds].sort().join(',');
  
  // Check if there's already a pending request for this exact batch
  if (pendingRequests.has(batchKey)) {
    return pendingRequests.get(batchKey)!;
  }
  
  const fetchPromise = (async () => {
    const newDisplayNames: Record<string, string> = {};
    
    try {
      // Try direct profiles query first (faster, no edge function overhead)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, "Email ID"')
        .in('id', userIds);

      if (!profilesError && profilesData) {
        profilesData.forEach((profile) => {
          let displayName = "Unknown User";
          
          if (profile.full_name?.trim() && 
              !profile.full_name.includes('@') &&
              profile.full_name !== profile["Email ID"]) {
            displayName = profile.full_name.trim();
          } else if (profile["Email ID"]) {
            displayName = profile["Email ID"].split('@')[0];
          }
          
          newDisplayNames[profile.id] = displayName;
          displayNameCache.set(profile.id, displayName);
        });
      }

      // Set fallback for any missing users
      userIds.forEach(id => {
        if (!newDisplayNames[id]) {
          newDisplayNames[id] = "Unknown User";
          displayNameCache.set(id, "Unknown User");
        }
      });

      // Persist to localStorage
      saveCacheToStorage();
      
    } catch (error) {
      console.warn('Error fetching display names:', error);
      // Set fallback names
      userIds.forEach(id => {
        if (!displayNameCache.has(id)) {
          newDisplayNames[id] = "Unknown User";
          displayNameCache.set(id, "Unknown User");
        }
      });
    }
    
    return newDisplayNames;
  })();
  
  // Store the pending request
  pendingRequests.set(batchKey, fetchPromise);
  
  // Clean up after completion
  fetchPromise.finally(() => {
    pendingRequests.delete(batchKey);
  });
  
  return fetchPromise;
};

export const useUserDisplayNames = (userIds: string[]) => {
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const previousUserIds = useRef<string[]>([]);

  useEffect(() => {
    // Filter out empty/null userIds
    const validUserIds = userIds.filter(id => id && id.trim() !== '');
    
    if (validUserIds.length === 0) {
      setDisplayNames({});
      setLoading(false);
      return;
    }

    // Check if userIds actually changed
    const sortedCurrentIds = [...validUserIds].sort();
    const sortedPreviousIds = [...previousUserIds.current].sort();
    
    const hasChanged = sortedCurrentIds.length !== sortedPreviousIds.length || 
      !sortedCurrentIds.every((id, index) => id === sortedPreviousIds[index]);
    
    if (!hasChanged) return;

    previousUserIds.current = validUserIds;

    // Check cache first for immediate display
    // Skip cached "Unknown User" values to force refetch (in case RLS was fixed)
    const cachedNames: Record<string, string> = {};
    const uncachedIds: string[] = [];
    
    validUserIds.forEach(id => {
      const cached = displayNameCache.get(id);
      if (cached && cached !== 'Unknown User') {
        cachedNames[id] = cached;
      } else {
        uncachedIds.push(id);
      }
    });

    // Set cached names immediately (no flicker)
    if (Object.keys(cachedNames).length > 0) {
      setDisplayNames(prev => ({ ...prev, ...cachedNames }));
    }

    // If all IDs are cached, we're done
    if (uncachedIds.length === 0) {
      setLoading(false);
      return;
    }

    // Fetch uncached IDs
    setLoading(true);
    
    fetchDisplayNamesForIds(uncachedIds)
      .then(newNames => {
        setDisplayNames(prev => ({ ...prev, ...cachedNames, ...newNames }));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [userIds.join(',')]);

  return { displayNames, loading };
};

// Pre-warm cache with common user IDs (call on app init)
export const preloadUserDisplayNames = async (userIds: string[]) => {
  const uncachedIds = userIds.filter(id => id && !displayNameCache.has(id));
  if (uncachedIds.length > 0) {
    await fetchDisplayNamesForIds(uncachedIds);
  }
};

// Clear cache (useful for logout)
export const clearUserDisplayNamesCache = () => {
  displayNameCache.clear();
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_EXPIRY_KEY);
  } catch (e) {
    // Silently fail
  }
};
