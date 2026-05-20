import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Returns a 7x24 matrix of sales counts per hour for the last 7 days.
 * Row index 0 = 6 days ago, row index 6 = today (local time).
 */
export const useWeeklySalesHeatmap = (branchId?: string) =>
  useQuery<number[][]>({
    queryKey: ['weekly-sales-heatmap', branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
      if (!branchId) return matrix;

      // Start of day 6 days ago (local midnight)
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - 6);

      const { data, error } = await supabase
        .from('sales')
        .select('created_at')
        .eq('branch_id', branchId)
        .eq('status', 'completed')
        .gte('created_at', start.toISOString())
        .limit(10000);

      if (error || !data) return matrix;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      data.forEach((row: any) => {
        const d = new Date(row.created_at);
        const dayDate = new Date(d);
        dayDate.setHours(0, 0, 0, 0);
        const dayDiff = Math.round((today.getTime() - dayDate.getTime()) / 86400000);
        const rowIdx = 6 - dayDiff;
        if (rowIdx < 0 || rowIdx > 6) return;
        const hour = d.getHours();
        matrix[rowIdx][hour] += 1;
      });

      return matrix;
    },
    refetchInterval: 60000,
  });
