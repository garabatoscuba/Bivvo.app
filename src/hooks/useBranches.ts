import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Branch } from '@/types/database';

export const useBranches = () => {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['branches', profile?.business_id],
    queryFn: async () => {
      if (!profile?.business_id) return [];
      
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('business_id', profile.business_id)
        .order('is_main', { ascending: false })
        .order('name');

      if (error) throw error;
      return data as Branch[];
    },
    enabled: !!profile?.business_id,
  });
};
