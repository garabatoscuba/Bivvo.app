import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays } from 'date-fns';

export type SubscriptionState = 'trial' | 'active' | 'expiring' | 'blocked';

interface SubscriptionInfo {
  status: SubscriptionState;
  daysLeft: number | null;
  isBlocked: boolean;
  planType: string;
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

  if (authLoading || isLoading || !business) {
    return { status: 'trial', daysLeft: null, isBlocked: false, planType: 'trial', trialEndsAt: null, subscriptionEndsAt: null, loading: true };
  }

  // Super admin never blocked
  if (isSuperAdmin) {
    return { status: 'active', daysLeft: null, isBlocked: false, planType: business.plan_type || 'trial', trialEndsAt: business.trial_ends_at, subscriptionEndsAt: business.subscription_ends_at, loading: false };
  }

  const now = new Date();

  // Active subscription
  if (business.subscription_status === 'active' && business.subscription_ends_at) {
    const subEnd = new Date(business.subscription_ends_at);
    const days = differenceInDays(subEnd, now);
    if (days < 0) {
      return { status: 'blocked', daysLeft: 0, isBlocked: true, planType: business.plan_type || 'mvp', trialEndsAt: business.trial_ends_at, subscriptionEndsAt: business.subscription_ends_at, loading: false };
    }
    if (days <= 3) {
      return { status: 'expiring', daysLeft: days, isBlocked: false, planType: business.plan_type || 'mvp', trialEndsAt: business.trial_ends_at, subscriptionEndsAt: business.subscription_ends_at, loading: false };
    }
    return { status: 'active', daysLeft: days, isBlocked: false, planType: business.plan_type || 'mvp', trialEndsAt: business.trial_ends_at, subscriptionEndsAt: business.subscription_ends_at, loading: false };
  }

  // Suspended or cancelled
  if (business.subscription_status === 'suspended' || business.subscription_status === 'cancelled') {
    return { status: 'blocked', daysLeft: 0, isBlocked: true, planType: business.plan_type || 'trial', trialEndsAt: business.trial_ends_at, subscriptionEndsAt: business.subscription_ends_at, loading: false };
  }

  // Trial
  if (business.trial_ends_at) {
    const trialEnd = new Date(business.trial_ends_at);
    const days = differenceInDays(trialEnd, now);
    if (days < 0) {
      return { status: 'blocked', daysLeft: 0, isBlocked: true, planType: 'trial', trialEndsAt: business.trial_ends_at, subscriptionEndsAt: null, loading: false };
    }
    if (days <= 3) {
      return { status: 'expiring', daysLeft: days, isBlocked: false, planType: 'trial', trialEndsAt: business.trial_ends_at, subscriptionEndsAt: null, loading: false };
    }
    return { status: 'trial', daysLeft: days, isBlocked: false, planType: 'trial', trialEndsAt: business.trial_ends_at, subscriptionEndsAt: null, loading: false };
  }

  return { status: 'blocked', daysLeft: 0, isBlocked: true, planType: 'trial', trialEndsAt: null, subscriptionEndsAt: null, loading: false };
};
