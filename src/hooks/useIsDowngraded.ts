import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Returns true if the user is on the free plan but previously had an approved paid plan.
 * This means their plan was downgraded and certain features should be restricted.
 */
export const useIsDowngraded = (): { isDowngraded: boolean; isLoading: boolean } => {
  const { user, profile } = useAuth();

  const { data: hasApprovedPlan = false, isLoading } = useQuery({
    queryKey: ['has-approved-plan', user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('plan_requests')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('status', 'approved');
      if (error) return false;
      return (count ?? 0) > 0;
    },
    enabled: !!user?.id && profile?.plan_type === 'free',
    staleTime: 5 * 60 * 1000,
  });

  return {
    isDowngraded: profile?.plan_type === 'free' && hasApprovedPlan,
    isLoading,
  };
};
