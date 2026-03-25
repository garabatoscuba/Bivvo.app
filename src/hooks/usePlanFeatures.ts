import { useSubscription, PlanType } from '@/hooks/useSubscription';

export type PlanFeatureKey =
  // Enterprise-only: Contabilidad module
  | 'contabilidad'
  | 'contabilidad_activos'
  | 'contabilidad_analisis'
  | 'contabilidad_avanzado'
  | 'contabilidad_documentos';

const ENTERPRISE_FEATURES: PlanFeatureKey[] = [
  'contabilidad',
  'contabilidad_activos',
  'contabilidad_analisis',
  'contabilidad_avanzado',
  'contabilidad_documentos',
];

const FREE_PRODUCT_LIMIT = 5;
const FREE_SERVICE_CATEGORY_LIMIT = 2;

interface PlanFeatures {
  plan: PlanType;
  loading: boolean;
  hasFeature: (key: PlanFeatureKey) => boolean;
  canCreateProduct: (currentCount: number) => boolean;
  canCreateServiceCategory: (currentCount: number) => boolean;
  productLimit: number | null;
  serviceCategoryLimit: number | null;
  planLabel: string;
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

  const canCreateServiceCategory = (currentCount: number): boolean => {
    if (planType === 'free') return currentCount < FREE_SERVICE_CATEGORY_LIMIT;
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
    canCreateServiceCategory,
    productLimit: planType === 'free' ? FREE_PRODUCT_LIMIT : null,
    serviceCategoryLimit: planType === 'free' ? FREE_SERVICE_CATEGORY_LIMIT : null,
    planLabel,
    requiredPlanFor,
  };
};
