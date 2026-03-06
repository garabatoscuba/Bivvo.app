import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface AssistantFeature {
  id: string;
  key: string;
  is_active: boolean;
}

interface FeatureRole {
  feature_id: string;
  role: string;
  is_allowed: boolean;
}

interface FeaturePricing {
  feature_id: string;
  plan_type: string;
  availability: string;
}

/**
 * Resolves which assistant features are enabled for the current user
 * based on global toggle, role permissions, and plan availability.
 */
export function useAssistantFeatures() {
  const { profile, isOwner, isManager, isSeller, isSuperAdmin } = useAuth();

  const planType = profile?.plan_type || 'free';

  // Determine the user's role key for feature_roles lookup
  const userRole = isSuperAdmin
    ? 'owner' // super admin gets owner-level access
    : isOwner
      ? 'owner'
      : isManager
        ? 'manager'
        : isSeller
          ? 'employee'
          : 'employee'; // default to employee for partner/other

  const { data, isLoading } = useQuery({
    queryKey: ['assistant-features-access', userRole, planType],
    queryFn: async () => {
      const [featuresRes, rolesRes, pricingRes, configRes] = await Promise.all([
        supabase.from('assistant_features').select('id, key, is_active'),
        supabase.from('assistant_feature_roles').select('feature_id, role, is_allowed'),
        supabase.from('assistant_feature_pricing').select('feature_id, plan_type, availability'),
        supabase.from('assistant_config').select('is_enabled').limit(1).single(),
      ]);
      return {
        features: (featuresRes.data || []) as unknown as AssistantFeature[],
        roles: (rolesRes.data || []) as unknown as FeatureRole[],
        pricing: (pricingRes.data || []) as unknown as FeaturePricing[],
        globalEnabled: (configRes.data as any)?.is_enabled ?? true,
      };
    },
    staleTime: 5 * 60 * 1000, // cache 5 min
  });

  const isFeatureEnabled = (key: string): boolean => {
    if (!data) return false;
    // Super admin always has access
    if (isSuperAdmin) return true;

    // Global kill switch from assistant_config
    if (!data.globalEnabled) return false;

    const feature = data.features.find(f => f.key === key);
    if (!feature || !feature.is_active) return false;

    // Check role permission
    const roleEntry = data.roles.find(
      r => r.feature_id === feature.id && r.role === userRole
    );
    if (roleEntry && !roleEntry.is_allowed) return false;

    // Check plan availability
    const pricingEntry = data.pricing.find(
      p => p.feature_id === feature.id && p.plan_type === planType
    );
    if (pricingEntry && (pricingEntry.availability === 'unavailable' || pricingEntry.availability === 'not_available')) {
      return false;
    }

    return true;
  };

  const canChat = isFeatureEnabled('assistant_chat');

  return {
    isLoading,
    canNotifications: isFeatureEnabled('notifications'),
    canContextMenu: isFeatureEnabled('context_menu'),
    canChat,
    /** True if at least one feature is available (show the button) */
    hasAnyFeature: isFeatureEnabled('notifications') || isFeatureEnabled('context_menu') || canChat,
  };
}
