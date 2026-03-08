import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fetches print_jobs totals for a given business/branch in a date range.
 * Only executes when isCopyShop is true.
 */
export function usePrintJobTotals({
  businessId,
  branchId,
  branchIds,
  from,
  to,
  enabled = true,
}: {
  businessId?: string | null;
  branchId?: string | null;
  branchIds?: string[];
  from?: string | null;
  to?: string | null;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ['print-job-totals', businessId, branchId, branchIds, from, to],
    queryFn: async () => {
      if (!businessId) return 0;
      let q = supabase.from('print_jobs').select('total').eq('business_id', businessId);
      if (branchId) q = q.eq('branch_id', branchId);
      else if (branchIds?.length) q = q.in('branch_id', branchIds);
      if (from) q = q.gte('created_at', from);
      if (to) q = q.lte('created_at', to);
      const { data } = await q;
      return data?.reduce((sum, r) => sum + Number(r.total || 0), 0) || 0;
    },
    enabled: enabled && !!businessId,
  });
}

/**
 * Check if a business is a copy_shop type.
 */
export function useIsCopyShop(businessId?: string | null) {
  return useQuery({
    queryKey: ['is-copy-shop', businessId],
    queryFn: async () => {
      if (!businessId) return false;
      const { data } = await supabase
        .from('businesses')
        .select('business_type')
        .eq('id', businessId)
        .maybeSingle();
      return data?.business_type === 'copy_shop';
    },
    enabled: !!businessId,
    staleTime: 5 * 60 * 1000,
  });
}
