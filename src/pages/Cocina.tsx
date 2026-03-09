import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ChefHat, Clock, CheckCircle2, Loader2, RefreshCw, AlertTriangle, Volume2, VolumeX, PackageCheck, StickyNote } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useIsRestaurant } from '@/hooks/useIsRestaurant';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

type KitchenStatus = 'recibido' | 'preparando' | 'listo' | 'entregado';

interface KitchenOrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  sale_item_id: string;
  notes?: string;
}

interface KitchenOrder {
  id: string;
  business_id: string;
  branch_id: string;
  sale_id: string;
  status: KitchenStatus;
  items: KitchenOrderItem[];
  notes: string;
  priority: string;
  sale_number: string;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<KitchenStatus, { label: string; colorClass: string; icon: typeof Clock; actionLabel?: string }> = {
  recibido: { label: 'Recibido', colorClass: 'border-warning/50 bg-warning/10', icon: Clock, actionLabel: 'Empezar a preparar' },
  preparando: { label: 'Preparando', colorClass: 'border-blue-500/50 bg-blue-500/10', icon: RefreshCw, actionLabel: 'Marcar listo' },
  listo: { label: 'Listo', colorClass: 'border-green-500/50 bg-green-500/10', icon: CheckCircle2, actionLabel: 'Entrega' },
  entregado: { label: 'Entregado', colorClass: 'border-muted bg-muted/30', icon: PackageCheck },
};

const NEXT_STATUS: Partial<Record<KitchenStatus, KitchenStatus>> = {
  recibido: 'preparando',
  preparando: 'listo',
  listo: 'entregado',
};

// Alert threshold in minutes
const ALERT_MINUTES = 10;

const Cocina = () => {
  const { profile } = useAuth();
  const { businessId, branchId } = useResolvedBusinessId();
  const { isRestaurant, isLoading: restaurantLoading } = useIsRestaurant();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(new Date());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<KitchenOrder | null>(null);
  const [orderNotes, setOrderNotes] = useState('');
  const prevOrderCountRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Timer for elapsed time display
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(interval);
  }, []);

  // Initialize audio
  useEffect(() => {
    // Create a simple beep using AudioContext when needed
    audioRef.current = new Audio('data:audio/wav;base64,UklGRl9vT19teleUkVGRk1teleAgAAAABmYWN0BAAAAAAAAABkYXRh');
  }, []);

  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      osc.type = 'sine';
      gain.gain.value = 0.3;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.stop(ctx.currentTime + 0.5);
      // Second beep
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 1000;
        osc2.type = 'sine';
        gain2.gain.value = 0.3;
        osc2.start();
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc2.stop(ctx.currentTime + 0.5);
      }, 200);
    } catch {
      // Audio not available
    }
  }, [soundEnabled]);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['kitchen-orders', businessId, branchId],
    queryFn: async () => {
      if (!businessId || !branchId) return [];
      const { data, error } = await supabase
        .from('kitchen_orders')
        .select('*')
        .eq('business_id', businessId)
        .eq('branch_id', branchId)
        .in('status', ['recibido', 'preparando', 'listo', 'entregado'])
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as KitchenOrder[];
    },
    enabled: !!businessId && !!branchId,
    refetchInterval: 10000,
  });

  // Sound notification for new orders
  useEffect(() => {
    const activeCount = orders.filter(o => o.status === 'recibido').length;
    if (activeCount > prevOrderCountRef.current && prevOrderCountRef.current >= 0) {
      playNotificationSound();
    }
    prevOrderCountRef.current = activeCount;
  }, [orders, playNotificationSound]);

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

  const updateNotesMutation = useMutation({
    mutationFn: async ({ orderId, notes }: { orderId: string; notes: string }) => {
      const { error } = await supabase
        .from('kitchen_orders')
        .update({ notes })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
      setNotesDialogOpen(false);
      toast({ title: 'Nota guardada' });
    },
  });

  const pendingOrders = useMemo(() => orders.filter(o => o.status === 'recibido'), [orders]);
  const preparingOrders = useMemo(() => orders.filter(o => o.status === 'preparando'), [orders]);
  const readyOrders = useMemo(() => orders.filter(o => o.status === 'listo'), [orders]);
  const deliveredOrders = useMemo(() => orders.filter(o => o.status === 'entregado').slice(0, 20), [orders]);
  const activeOrders = useMemo(() => orders.filter(o => o.status !== 'entregado'), [orders]);

  // Block access for non-restaurant businesses
  if (!restaurantLoading && !isRestaurant) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">Este módulo solo está disponible para restaurantes y cafeterías.</p>
        </div>
      </AppLayout>
    );
  }

  const getElapsedMinutes = (createdAt: string) => {
    return Math.floor((now.getTime() - new Date(createdAt).getTime()) / 60000);
  };

  const openNotesDialog = (order: KitchenOrder) => {
    setSelectedOrder(order);
    setOrderNotes(order.notes || '');
    setNotesDialogOpen(true);
  };

  const renderOrderCard = (order: KitchenOrder) => {
    const config = STATUS_CONFIG[order.status];
    const StatusIcon = config.icon;
    const nextStatus = NEXT_STATUS[order.status];
    const elapsed = formatDistanceToNow(new Date(order.created_at), { locale: es, addSuffix: false });
    const elapsedMin = getElapsedMinutes(order.created_at);
    const isLate = order.status !== 'listo' && order.status !== 'entregado' && elapsedMin >= ALERT_MINUTES;
    const saleLabel = order.sale_number || `#${order.sale_id.slice(-6).toUpperCase()}`;

    return (
      <Card key={order.id} className={cn('border-2 transition-all', config.colorClass, isLate && 'ring-2 ring-destructive/50 animate-pulse')}>
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <StatusIcon className="h-4 w-4" />
              {saleLabel}
            </CardTitle>
            <div className="flex items-center gap-1.5">
              {isLate && <AlertTriangle className="h-4 w-4 text-destructive" />}
              <Badge variant="outline" className={cn('text-xs font-mono', isLate && 'border-destructive text-destructive')}>
                <Clock className="h-3 w-3 mr-1" />
                {elapsed}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-3">
          <div className="space-y-1.5">
            {(order.items as KitchenOrderItem[]).map((item, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{item.product_name}</span>
                  <Badge variant="secondary" className="text-xs font-bold">
                    x{item.quantity}
                  </Badge>
                </div>
                {item.notes && (
                  <p className="text-xs text-muted-foreground italic pl-2">📝 {item.notes}</p>
                )}
              </div>
            ))}
          </div>

          {order.notes && (
            <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
              <span className="font-medium">Nota:</span> {order.notes}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => openNotesDialog(order)}
            >
              <StickyNote className="h-3.5 w-3.5 mr-1" />
              Nota
            </Button>
            {nextStatus && (
              <Button
                className="flex-1"
                size="sm"
                variant={order.status === 'recibido' ? 'default' : 'outline'}
                onClick={() => updateStatusMutation.mutate({ orderId: order.id, newStatus: nextStatus })}
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  config.actionLabel
                )}
              </Button>
            )}
          </div>
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Silenciar notificaciones' : 'Activar notificaciones'}
          >
            {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5 text-muted-foreground" />}
          </Button>
        </div>

        {/* Status summary */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-warning">{pendingOrders.length}</p>
              <p className="text-xs text-muted-foreground">Pendientes</p>
            </CardContent>
          </Card>
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-blue-500">{preparingOrders.length}</p>
              <p className="text-xs text-muted-foreground">Preparando</p>
            </CardContent>
          </Card>
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-green-500">{readyOrders.length}</p>
              <p className="text-xs text-muted-foreground">Listos</p>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="board">
            <TabsList>
              <TabsTrigger value="board">Tablero</TabsTrigger>
              <TabsTrigger value="history">
                Entregados ({deliveredOrders.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="board" className="mt-4">
              {activeOrders.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <ChefHat className="h-12 w-12 text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground font-medium">No hay pedidos pendientes</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Los nuevos pedidos aparecerán automáticamente al vender productos elaborados</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  {/* Recibidos */}
                  {pendingOrders.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-warning mb-3 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Recibidos ({pendingOrders.length})
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {pendingOrders.map(renderOrderCard)}
                      </div>
                    </div>
                  )}

                  {/* Preparando */}
                  {preparingOrders.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-blue-500 mb-3 flex items-center gap-2">
                        <RefreshCw className="h-4 w-4" />
                        En preparación ({preparingOrders.length})
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {preparingOrders.map(renderOrderCard)}
                      </div>
                    </div>
                  )}

                  {/* Listos */}
                  {readyOrders.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-green-500 mb-3 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Listos para entregar ({readyOrders.length})
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {readyOrders.map(renderOrderCard)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              {deliveredOrders.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <PackageCheck className="h-12 w-12 text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground font-medium">No hay pedidos entregados hoy</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {deliveredOrders.map(renderOrderCard)}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Notes Dialog */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nota del pedido {selectedOrder?.sale_number || ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nota interna</Label>
              <Textarea
                value={orderNotes}
                onChange={e => setOrderNotes(e.target.value)}
                placeholder="Ej: Sin cebolla, extra queso..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => selectedOrder && updateNotesMutation.mutate({ orderId: selectedOrder.id, notes: orderNotes })}
              disabled={updateNotesMutation.isPending}
            >
              {updateNotesMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Cocina;
