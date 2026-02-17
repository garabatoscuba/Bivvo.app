import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOffline } from '@/contexts/OfflineContext';
import { getAllFromStore, putManyInStore } from '@/lib/offlineDb';
import type { Branch } from '@/types/database';

export const useBranches = () => {
  const { profile } = useAuth();
  const { isOnline } = useOffline();

  return useQuery({
    queryKey: ['branches', profile?.business_id],
    queryFn: async () => {
      if (!profile?.business_id) return [];

      if (isOnline) {
        try {
          const { data, error } = await supabase
            .from('branches')
            .select('*')
            .eq('business_id', profile.business_id)
            .order('is_main', { ascending: false })
            .order('name');

          if (error) throw error;
          await putManyInStore('branches', data as Branch[]);
          return data as Branch[];
        } catch (err) {
          console.warn('Branches online fetch failed, using cache:', err);
        }
      }

      const cached = await getAllFromStore<Branch>('branches', 'by-business', profile.business_id);
      return cached.sort((a, b) => {
        if (a.is_main && !b.is_main) return -1;
        if (!a.is_main && b.is_main) return 1;
        return a.name.localeCompare(b.name);
      });
    },
    enabled: !!profile?.business_id,
  });
};
