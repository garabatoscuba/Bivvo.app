import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useResolvedBusinessId } from './useResolvedBusinessId';

const RESTAURANT_KEY = 'estaurente/safetería';

export const useIsRestaurant = () => {
  const { businessId } = useResolvedBusinessId();

  const { data: isRestaurant = false, isLoading } = useQuery({
    queryKey: ['is-restaurant', businessId],
    queryFn: async () => {
      if (!businessId) return false;
      const { data } = await supabase
        .from('businesses')
        .select('business_type')
        .eq('id', businessId)
        .maybeSingle();
      return data?.business_type === RESTAURANT_KEY;
    },
    enabled: !!businessId,
    staleTime: 5 * 60 * 1000,
  });

  return { isRestaurant, isLoading };
};
