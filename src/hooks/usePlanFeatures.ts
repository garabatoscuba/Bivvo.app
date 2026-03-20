import { useSubscription, PlanType } from '@/hooks/useSubscription';

export type PlanFeatureKey =
  // Enterprise-only Reportes tabs
  | 'reportes_por_empleado'
  | 'reportes_comparativa'
  | 'reportes_vs'
  | 'reportes_bitacora'
  // Enterprise-only Contabilidad tabs
  | 'contabilidad_activos'
  | 'contabilidad_analisis'
  | 'contabilidad_avanzado'
  | 'contabilidad_documentos';

const ENTERPRISE_FEATURES: PlanFeatureKey[] = [
  'reportes_por_empleado',
  'reportes_comparativa',
  'reportes_vs',
  'reportes_bitacora',
  'contabilidad_activos',
  'contabilidad_analisis',
  'contabilidad_avanzado',
  'contabilidad_documentos',
];

const FREE_PRODUCT_LIMIT = 5;

interface PlanFeatures {
  plan: PlanType;
  loading: boolean;
  /** Check if a specific feature is available on the current plan */
  hasFeature: (key: PlanFeatureKey) => boolean;
  /** Whether the user can create a new product (free plan limit) */
  canCreateProduct: (currentCount: number) => boolean;
  /** Max products for free plan */
  productLimit: number | null;
  /** Plan label for display */
  planLabel: string;
  /** Required plan for a locked feature */
  requiredPlanFor: (key: PlanFeatureKey) => string;
}

export const usePlanFeatures = (): PlanFeatures => {
  const { planType, loading } = useSubscription();

  const hasFeature = (key: PlanFeatureKey): boolean => {
    if (planType === 'enterprise') return true;
    if (ENTERPRISE_FEATURES.includes(key)) return false;
    return true;
  };

  const canCreateProduct = (currentCount: number): boolean => {
    if (planType === 'free') return currentCount < FREE_PRODUCT_LIMIT;
    return true;
  };

  const planLabel =
    planType === 'enterprise' ? 'Enterprise' :
    planType === 'professional' ? 'Profesional' :
    'Gratuito';

  const requiredPlanFor = (key: PlanFeatureKey): string => {
    if (ENTERPRISE_FEATURES.includes(key)) return 'Enterprise';
    return 'Profesional';
  };

  return {
    plan: planType,
    loading,
    hasFeature,
    canCreateProduct,
    productLimit: planType === 'free' ? FREE_PRODUCT_LIMIT : null,
    planLabel,
    requiredPlanFor,
  };
};
