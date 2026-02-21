import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type PlanType = 'free' | 'basic' | 'professional';
export type SubscriptionState = 'active' | 'trial' | 'expiring' | 'blocked';

interface SubscriptionInfo {
  status: SubscriptionState;
  planType: PlanType;
  daysLeft: number | null;
  isBlocked: boolean;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  totalBranches: number;
  totalMonthly: number;
  loading: boolean;
}

export const useSubscription = (): SubscriptionInfo => {
  const { profile, isSuperAdmin, loading: authLoading } = useAuth();

  // Count ALL branches across ALL businesses owned by this user
  const { data: branchCount = 0, isLoading: branchLoading } = useQuery({
    queryKey: ['user-total-branches', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return 0;
      const { data: businesses } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', profile.id);
      if (!businesses || businesses.length === 0) return 0;
      const bizIds = businesses.map(b => b.id);
      const { count } = await supabase
        .from('branches')
        .select('id', { count: 'exact', head: true })
        .in('business_id', bizIds);
      return count || 0;
    },
    enabled: !!profile?.user_id,
  });

  // Get server time to prevent client-side date manipulation
  const { data: serverNow, isLoading: serverTimeLoading } = useQuery({
    queryKey: ['server-time'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_server_now');
      if (error) throw error;
      return new Date(data as string);
    },
    refetchInterval: 5 * 60 * 1000, // refresh every 5 min
    staleTime: 60 * 1000, // 1 min stale time
  });

  const defaults: SubscriptionInfo = {
    status: 'active',
    planType: 'free',
    daysLeft: null,
    isBlocked: false,
    trialEndsAt: null,
    subscriptionEndsAt: null,
    totalBranches: 0,
    totalMonthly: 0,
    loading: true,
  };

  if (authLoading || branchLoading || serverTimeLoading || !profile || !serverNow) return defaults;

  const plan = (profile.plan_type || 'free') as PlanType;
  const pricePerBranch = plan === 'professional' ? 20 : plan === 'basic' ? 10 : 0;
  const totalBranches = Math.max(1, branchCount);
  const totalMonthly = pricePerBranch * totalBranches;

  const base = {
    trialEndsAt: profile.trial_ends_at,
    subscriptionEndsAt: profile.subscription_ends_at,
    totalBranches,
    totalMonthly,
    loading: false,
  };

  // Super admin never blocked
  if (isSuperAdmin) {
    return { ...base, status: 'active', planType: plan, daysLeft: null, isBlocked: false };
  }

  // Soft-deleted user is blocked
  if (profile.deleted_at) {
    return { ...base, status: 'blocked', planType: plan, daysLeft: null, isBlocked: true };
  }

  // Free plan — always active, never blocked
  if (plan === 'free') {
    return { ...base, status: 'active', planType: 'free', daysLeft: null, isBlocked: false };
  }

  // Use server time instead of client time
  const now = serverNow;

  // Helper: difference in days
  const diffDays = (target: Date, from: Date) => {
    const diff = target.getTime() - from.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  // Active paid subscription
  if (profile.subscription_status === 'active' && profile.subscription_ends_at) {
    const days = diffDays(new Date(profile.subscription_ends_at), now);
    if (days < 0) {
      return { ...base, status: 'blocked', planType: plan, daysLeft: 0, isBlocked: true };
    }
    if (days <= 3) {
      return { ...base, status: 'expiring', planType: plan, daysLeft: days, isBlocked: false };
    }
    return { ...base, status: 'active', planType: plan, daysLeft: days, isBlocked: false };
  }

  // Suspended or cancelled
  if (profile.subscription_status === 'suspended' || profile.subscription_status === 'cancelled') {
    return { ...base, status: 'blocked', planType: plan, daysLeft: 0, isBlocked: true };
  }

  // Trial period
  if (profile.trial_ends_at) {
    const days = diffDays(new Date(profile.trial_ends_at), now);
    if (days < 0) {
      return { ...base, status: 'blocked', planType: plan, daysLeft: 0, isBlocked: true };
    }
    if (days <= 2) {
      return { ...base, status: 'expiring', planType: plan, daysLeft: days, isBlocked: false };
    }
    return { ...base, status: 'trial', planType: plan, daysLeft: days, isBlocked: false };
  }

  return { ...base, status: 'blocked', planType: plan, daysLeft: 0, isBlocked: true };
};
