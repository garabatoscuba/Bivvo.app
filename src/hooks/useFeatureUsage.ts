import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const ROUTE_FEATURE_MAP: Record<string, string> = {
  '/': 'dashboard',
  '/pos': 'pos',
  '/inventory': 'inventory',
  '/services': 'services',
  '/caja': 'caja',
  '/employees': 'employees',
  '/sales': 'sales',
  '/cobros': 'reports',
  '/orders': 'orders',
  '/nomina': 'nomina',
  '/settings': 'settings',
  '/plans': 'plans',
  '/store-settings': 'portal',
};

/**
 * Silently tracks feature usage when navigating modules.
 * Used by the AI assistant to recommend unused features.
 */
export function useFeatureUsage() {
  const { pathname } = useLocation();
  const { profile } = useAuth();

  useEffect(() => {
    const featureKey = ROUTE_FEATURE_MAP[pathname];
    if (!featureKey || !profile?.business_id || !profile?.user_id) return;

    // Fire-and-forget upsert
    supabase
      .from('assistant_feature_usage')
      .upsert(
        {
          business_id: profile.business_id,
          user_id: profile.user_id,
          feature_key: featureKey,
          last_used_at: new Date().toISOString(),
          use_count: 1,
        },
        { onConflict: 'business_id,user_id,feature_key' }
      )
      .then(({ error }) => {
        if (error && !error.message.includes('duplicate')) {
          // If upsert doesn't increment, do an RPC or just let it be
          console.debug('Feature usage track:', error.message);
        }
      });

    // Also increment use_count via a separate update
    supabase.rpc('increment_feature_usage' as any, {
      _business_id: profile.business_id,
      _user_id: profile.user_id,
      _feature_key: featureKey,
    }).then(() => {/* silent */});
  }, [pathname, profile?.business_id, profile?.user_id]);
}
