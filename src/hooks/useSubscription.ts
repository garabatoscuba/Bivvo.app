import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays } from 'date-fns';

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
      // Get all businesses where user's profile.id is the owner
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

  if (authLoading || branchLoading || !profile) return defaults;

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

  const now = new Date();

  // Active paid subscription
  if (profile.subscription_status === 'active' && profile.subscription_ends_at) {
    const days = differenceInDays(new Date(profile.subscription_ends_at), now);
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
    const days = differenceInDays(new Date(profile.trial_ends_at), now);
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
