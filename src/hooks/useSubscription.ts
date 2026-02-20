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
  loading: boolean;
}

export const useSubscription = (): SubscriptionInfo => {
  const { profile, isSuperAdmin, loading: authLoading } = useAuth();

  const { data: business, isLoading } = useQuery({
    queryKey: ['business-subscription', profile?.business_id],
    queryFn: async () => {
      if (!profile?.business_id) return null;
      const { data, error } = await supabase
        .from('businesses')
        .select('subscription_status, trial_ends_at, subscription_ends_at, plan_type, max_branches')
        .eq('id', profile.business_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.business_id,
  });

  const defaults: SubscriptionInfo = {
    status: 'active',
    planType: 'free',
    daysLeft: null,
    isBlocked: false,
    trialEndsAt: null,
    subscriptionEndsAt: null,
    loading: true,
  };

  if (authLoading || isLoading || !business) return defaults;

  const plan = (business.plan_type || 'free') as PlanType;
  const base = {
    trialEndsAt: business.trial_ends_at,
    subscriptionEndsAt: business.subscription_ends_at,
    loading: false,
  };

  // Super admin never blocked
  if (isSuperAdmin) {
    return { ...base, status: 'active', planType: plan, daysLeft: null, isBlocked: false };
  }

  // Free plan — always active, never blocked
  if (plan === 'free') {
    return { ...base, status: 'active', planType: 'free', daysLeft: null, isBlocked: false };
  }

  const now = new Date();

  // Active paid subscription
  if (business.subscription_status === 'active' && business.subscription_ends_at) {
    const days = differenceInDays(new Date(business.subscription_ends_at), now);
    if (days < 0) {
      // Subscription expired → downgrade to free (not blocked)
      return { ...base, status: 'blocked', planType: plan, daysLeft: 0, isBlocked: true };
    }
    if (days <= 3) {
      return { ...base, status: 'expiring', planType: plan, daysLeft: days, isBlocked: false };
    }
    return { ...base, status: 'active', planType: plan, daysLeft: days, isBlocked: false };
  }

  // Suspended or cancelled
  if (business.subscription_status === 'suspended' || business.subscription_status === 'cancelled') {
    return { ...base, status: 'blocked', planType: plan, daysLeft: 0, isBlocked: true };
  }

  // Trial period (for basic/professional)
  if (business.trial_ends_at) {
    const days = differenceInDays(new Date(business.trial_ends_at), now);
    if (days < 0) {
      // Trial expired → user sees blocked, must choose plan or stays free
      return { ...base, status: 'blocked', planType: plan, daysLeft: 0, isBlocked: true };
    }
    if (days <= 2) {
      return { ...base, status: 'expiring', planType: plan, daysLeft: days, isBlocked: false };
    }
    return { ...base, status: 'trial', planType: plan, daysLeft: days, isBlocked: false };
  }

  // Pending subscription with no trial
  return { ...base, status: 'blocked', planType: plan, daysLeft: 0, isBlocked: true };
};
