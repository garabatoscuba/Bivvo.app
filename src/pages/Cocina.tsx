import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useResolvedBusinessId } from '@/hooks/useResolvedBusinessId';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChefHat, Clock, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useIsRestaurant } from '@/hooks/useIsRestaurant';

type KitchenStatus = 'recibido' | 'preparando' | 'listo';

interface KitchenOrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  sale_item_id: string;
}

interface KitchenOrder {
  id: string;
  business_id: string;
  branch_id: string;
  sale_id: string;
  status: KitchenStatus;
  items: KitchenOrderItem[];
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<KitchenStatus, { label: string; color: string; icon: typeof Clock }> = {
  recibido: { label: 'Recibido', color: 'bg-warning/15 text-warning border-warning/30', icon: Clock },
  preparando: { label: 'En preparación', color: 'bg-info/15 text-info border-info/30', icon: RefreshCw },
  listo: { label: 'Listo', color: 'bg-success/15 text-success border-success/30', icon: CheckCircle2 },
};

const NEXT_STATUS: Record<string, KitchenStatus> = {
  recibido: 'preparando',
  preparando: 'listo',
};

const Cocina = () => {
  const { profile } = useAuth();
  const { businessId, branchId } = useResolvedBusinessId();
  const { isRestaurant, isLoading: restaurantLoading } = useIsRestaurant();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(new Date());

  // Timer for elapsed time display
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['kitchen-orders', businessId, branchId],
    queryFn: async () => {
      if (!businessId || !branchId) return [];
      const { data, error } = await supabase
        .from('kitchen_orders')
        .select('*')
        .eq('business_id', businessId)
        .eq('branch_id', branchId)
        .in('status', ['recibido', 'preparando', 'listo'])
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as KitchenOrder[];
    },
    enabled: !!businessId && !!branchId,
    refetchInterval: 10000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!businessId || !branchId) return;
    const channel = supabase
      .channel('kitchen-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'kitchen_orders',
          filter: `business_id=eq.${businessId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['kitchen-orders', businessId, branchId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, branchId, queryClient]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, newStatus }: { orderId: string; newStatus: KitchenStatus }) => {
      const { error } = await supabase
        .from('kitchen_orders')
        .update({ status: newStatus })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
    },
  });

  const activeOrders = useMemo(() => orders.filter(o => o.status !== 'listo'), [orders]);
  const completedOrders = useMemo(() => orders.filter(o => o.status === 'listo').slice(0, 20), [orders]);

  const getSaleNumber = (saleId: string) => saleId.slice(-6).toUpperCase();

  const renderOrderCard = (order: KitchenOrder) => {
    const config = STATUS_CONFIG[order.status];
    const StatusIcon = config.icon;
    const nextStatus = NEXT_STATUS[order.status];
    const elapsed = formatDistanceToNow(new Date(order.created_at), { locale: es, addSuffix: false });

    return (
      <Card key={order.id} className={`border-2 ${config.color} transition-all`}>
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <StatusIcon className="h-4 w-4" />
              #{getSaleNumber(order.sale_id)}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-mono">
                <Clock className="h-3 w-3 mr-1" />
                {elapsed}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-3">
          <div className="space-y-1.5">
            {(order.items as KitchenOrderItem[]).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="font-medium">{item.product_name}</span>
                <Badge variant="secondary" className="text-xs font-bold">
                  x{item.quantity}
                </Badge>
              </div>
            ))}
          </div>
          {nextStatus && (
            <>
              <Separator />
              <Button
                className="w-full"
                variant={order.status === 'recibido' ? 'default' : 'outline'}
                onClick={() => updateStatusMutation.mutate({ orderId: order.id, newStatus: nextStatus })}
                disabled={updateStatusMutation.isPending}
              >
                {order.status === 'recibido' ? '🔵 Empezar a preparar' : '🟢 Marcar como listo'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ChefHat className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Cocina (KDS)</h1>
              <p className="text-xs text-muted-foreground">
                {activeOrders.length} pedido{activeOrders.length !== 1 ? 's' : ''} activo{activeOrders.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="active">
            <TabsList>
              <TabsTrigger value="active">
                Activos ({activeOrders.length})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completados ({completedOrders.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-4">
              {activeOrders.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <ChefHat className="h-12 w-12 text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground font-medium">No hay pedidos pendientes</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Los nuevos pedidos aparecerán aquí automáticamente</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {activeOrders.map(renderOrderCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed" className="mt-4">
              {completedOrders.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <CheckCircle2 className="h-12 w-12 text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground font-medium">No hay pedidos completados</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {completedOrders.map(renderOrderCard)}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
};

export default Cocina;
