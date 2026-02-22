import { useState } from 'react';
import { useNotifications, type Notification } from '@/hooks/useNotifications';
import AppLayout from '@/components/layout/AppLayout';
import { Package, Phone, MapPin, Clock, CheckCircle, XCircle, Eye, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type OrderStatus = 'pending' | 'confirmed' | 'delivered' | 'cancelled';

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: 'Pendiente', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', icon: Clock },
  confirmed: { label: 'Confirmado', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: CheckCircle },
  delivered: { label: 'Entregado', color: 'bg-green-500/10 text-green-600 border-green-500/20', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'bg-red-500/10 text-red-600 border-red-500/20', icon: XCircle },
};

const Orders = () => {
  const { notifications, markAsRead } = useNotifications();
  const { toast } = useToast();
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter only storefront_order notifications
  const orders = notifications.filter(n => n.type === 'storefront_order');

  const getOrderStatus = (n: Notification): OrderStatus => {
    return (n.metadata?.status as OrderStatus) || 'pending';
  };

  const filtered = filter === 'all' ? orders : orders.filter(n => getOrderStatus(n) === filter);

  const updateOrderStatus = async (notifId: string, status: OrderStatus) => {
    const notif = orders.find(n => n.id === notifId);
    if (!notif) return;

    const newMetadata = { ...notif.metadata, status };
    const { error } = await supabase
      .from('notifications')
      .update({ metadata: newMetadata as any, is_read: true })
      .eq('id', notifId);

    if (error) {
      toast({ title: 'Error al actualizar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `Pedido ${STATUS_CONFIG[status].label.toLowerCase()}` });
      markAsRead(notifId);
      // Force re-render by reloading
      window.location.reload();
    }
  };

  const counts = {
    all: orders.length,
    pending: orders.filter(n => getOrderStatus(n) === 'pending').length,
    confirmed: orders.filter(n => getOrderStatus(n) === 'confirmed').length,
    delivered: orders.filter(n => getOrderStatus(n) === 'delivered').length,
    cancelled: orders.filter(n => getOrderStatus(n) === 'cancelled').length,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Pedidos</h1>
          <p className="text-sm text-muted-foreground">Gestiona los pedidos recibidos desde tu portal</p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['all', 'pending', 'confirmed', 'delivered', 'cancelled'] as const).map(key => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`shrink-0 text-xs font-medium px-4 py-2 rounded-full border transition-colors ${
                filter === key
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {key === 'all' ? 'Todos' : STATUS_CONFIG[key].label} ({counts[key]})
            </button>
          ))}
        </div>

        {/* Orders list */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">No hay pedidos</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(order => {
              const status = getOrderStatus(order);
              const config = STATUS_CONFIG[status];
              const meta = order.metadata || {};
              const items = (meta.items as any[]) || [];
              const isExpanded = expandedId === order.id;

              return (
                <div key={order.id} className="border border-border rounded-xl bg-card overflow-hidden">
                  {/* Header */}
                  <button
                    onClick={() => { setExpandedId(isExpanded ? null : order.id); if (!order.is_read) markAsRead(order.id); }}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {!order.is_read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{meta.customer_name || 'Cliente'}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold">Bs {Number(meta.subtotal || 0).toFixed(2)}</span>
                      <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                        {config.label}
                      </Badge>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-border p-4 space-y-4">
                      {/* Contact info */}
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        {meta.customer_phone && (
                          <a href={`tel:${meta.customer_phone}`} className="flex items-center gap-1 hover:text-foreground">
                            <Phone className="h-3 w-3" /> {meta.customer_phone}
                          </a>
                        )}
                        {meta.delivery_address && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {meta.delivery_address}
                          </span>
                        )}
                      </div>

                      {/* Items */}
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Productos</p>
                        {items.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-sm py-1">
                            <span>{item.quantity}x {item.product_name}</span>
                            <span className="font-medium">Bs {Number(item.total).toFixed(2)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm font-bold pt-2 border-t border-border">
                          <span>Total</span>
                          <span>Bs {Number(meta.subtotal || 0).toFixed(2)}</span>
                        </div>
                      </div>

                      {meta.notes && (
                        <p className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">📝 {meta.notes}</p>
                      )}

                      {/* Actions */}
                      {status === 'pending' && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => updateOrderStatus(order.id, 'confirmed')} className="flex-1">
                            <CheckCircle className="h-3.5 w-3.5 mr-1" /> Confirmar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => updateOrderStatus(order.id, 'cancelled')} className="text-destructive">
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar
                          </Button>
                        </div>
                      )}
                      {status === 'confirmed' && (
                        <Button size="sm" onClick={() => updateOrderStatus(order.id, 'delivered')} className="w-full">
                          <CheckCircle className="h-3.5 w-3.5 mr-1" /> Marcar entregado
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Orders;
