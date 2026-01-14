import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  full_name: string | null;
}

// Shared profiles hook with long cache time for performance
export const useProfiles = () => {
  return useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name');
      return (data || []) as Profile[];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - profiles rarely change
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 min
  });
};

// Helper to get display name from profiles
export const getDisplayName = (profiles: Profile[], userId: string | null | undefined): string => {
  if (!userId) return 'Unknown User';
  const profile = profiles.find(p => p.id === userId);
  if (profile?.full_name?.trim() && !profile.full_name.includes('@')) {
    return profile.full_name.trim();
  }
  return 'Unknown User';
};

// Create a name lookup map from profiles
export const createNameMap = (profiles: Profile[]): Record<string, string> => {
  const map: Record<string, string> = {};
  profiles.forEach(profile => {
    if (profile.full_name?.trim() && !profile.full_name.includes('@')) {
      map[profile.id] = profile.full_name.trim();
    } else {
      map[profile.id] = 'Unknown User';
    }
  });
  return map;
};
