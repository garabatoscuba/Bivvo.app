import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

interface KitchenOrderStatusProps {
  saleId: string;
  businessId: string;
}

const STATUS_DISPLAY: Record<string, { emoji: string; label: string; className: string }> = {
  recibido: { emoji: '🟡', label: 'En espera', className: 'bg-warning/15 text-warning' },
  preparando: { emoji: '🔵', label: 'En preparación', className: 'bg-info/15 text-info' },
  listo: { emoji: '🟢', label: 'Listo', className: 'bg-success/15 text-success' },
};

export const KitchenOrderStatus = ({ saleId, businessId }: KitchenOrderStatusProps) => {
  const queryClient = useQueryClient();

  const { data: kitchenOrder } = useQuery({
    queryKey: ['kitchen-order-status', saleId],
    queryFn: async () => {
      const { data } = await supabase
        .from('kitchen_orders')
        .select('id, status')
        .eq('sale_id', saleId)
        .maybeSingle();
      return data;
    },
    enabled: !!saleId,
  });

  // Realtime for this specific order
  useEffect(() => {
    if (!saleId || !businessId) return;
    const channel = supabase
      .channel(`kitchen-status-${saleId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'kitchen_orders',
          filter: `sale_id=eq.${saleId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['kitchen-order-status', saleId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [saleId, businessId, queryClient]);

  if (!kitchenOrder) return null;

  const display = STATUS_DISPLAY[kitchenOrder.status] || STATUS_DISPLAY.recibido;

  return (
    <Badge variant="outline" className={`text-xs ${display.className}`}>
      {display.emoji} {display.label}
    </Badge>
  );
};
