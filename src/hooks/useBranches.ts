import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useResolvedBusinessId } from '@/hooks/useResolvedBusinessId';
import { useOffline } from '@/contexts/OfflineContext';
import { getAllFromStore, putManyInStore } from '@/lib/offlineDb';
import type { Branch } from '@/types/database';

export const useBranches = () => {
  const { profile } = useAuth();
  const { businessId: resolvedBusinessId } = useResolvedBusinessId();
  const { isOnline } = useOffline();
  const businessId = resolvedBusinessId || profile?.business_id;

  return useQuery({
    queryKey: ['branches', businessId],
    queryFn: async () => {
      if (!businessId) return [];

      if (isOnline) {
        try {
          const { data, error } = await supabase
            .from('branches')
            .select('*')
            .eq('business_id', businessId)
            .order('is_main', { ascending: false })
            .order('name');

          if (error) throw error;
          await putManyInStore('branches', data as Branch[]);
          return data as Branch[];
        } catch (err) {
          console.warn('Branches online fetch failed, using cache:', err);
        }
      }

      const cached = await getAllFromStore<Branch>('branches', 'by-business', businessId);
      return cached.sort((a, b) => {
        if (a.is_main && !b.is_main) return -1;
        if (!a.is_main && b.is_main) return 1;
        return a.name.localeCompare(b.name);
      });
    },
    enabled: !!businessId,
  });
};
