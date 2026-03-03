import { useState, useRef } from 'react';
import { useNotifications, type Notification } from '@/hooks/useNotifications';
import AppLayout from '@/components/layout/AppLayout';
import { Package, Phone, MapPin, Clock, CheckCircle, XCircle, ChevronDown, Loader2, Truck, Star, Copy, Link2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useJornadaActiva } from '@/hooks/useJornadaActiva';
import SinJornadaActiva from '@/components/employees/SinJornadaActiva';
import SinJornadaAutorizada from '@/components/employees/SinJornadaAutorizada';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QRCodeSVG } from 'qrcode.react';

type OrderStatus = 'new' | 'confirmed' | 'in_transit' | 'delivered' | 'cancelled';

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; icon: typeof Clock }> = {
  new: { label: 'Nuevo', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', icon: Clock },
  confirmed: { label: 'Confirmado', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: CheckCircle },
  in_transit: { label: 'En camino', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20', icon: Truck },
  delivered: { label: 'Entregado', color: 'bg-green-500/10 text-green-600 border-green-500/20', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'bg-red-500/10 text-red-600 border-red-500/20', icon: XCircle },
};

// Map old "pending" status to "new"
const normalizeStatus = (s: string): OrderStatus => {
  if (s === 'pending') return 'new';
  return (s as OrderStatus) || 'new';
};

const Orders = () => {
  const { notifications, markAsRead } = useNotifications();
  const { toast } = useToast();
  const { isOwner, isManager, isSuperAdmin, profile } = useAuth();
  const { jornadaActiva, jornada, isLoading: jornadaLoading } = useJornadaActiva();
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewDialog, setReviewDialog] = useState<{ open: boolean; token: string; url: string; customerName: string }>({
    open: false, token: '', url: '', customerName: '',
  });

  const orders = notifications.filter(n => n.type === 'storefront_order');

  const getOrderStatus = (n: Notification): OrderStatus => {
    return normalizeStatus((n.metadata?.status as string) || 'new');
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
      return;
    }
    
    toast({ title: `Pedido ${STATUS_CONFIG[status].label.toLowerCase()}` });
    markAsRead(notifId);

    // If marking as delivered, generate review token
    if (status === 'delivered' && notif.branch_id) {
      try {
        const { data: tokenData } = await (supabase
          .from('review_tokens' as any)
          .insert({
            branch_id: notif.branch_id,
            order_notification_id: notifId,
            customer_name: (notif.metadata?.customer_name as string) || 'Cliente',
          } as any)
          .select('token')
          .single() as any);

        if (tokenData?.token) {
          const reviewUrl = `${window.location.origin}/review/${tokenData.token}`;
          setReviewDialog({
            open: true,
            token: tokenData.token,
            url: reviewUrl,
            customerName: (notif.metadata?.customer_name as string) || 'Cliente',
          });
        }
      } catch {
        // Silent - review request is optional
      }
    }

    // Force re-render
    window.location.reload();
  };

  const counts = {
    all: orders.length,
    new: orders.filter(n => getOrderStatus(n) === 'new').length,
    confirmed: orders.filter(n => getOrderStatus(n) === 'confirmed').length,
    in_transit: orders.filter(n => getOrderStatus(n) === 'in_transit').length,
    delivered: orders.filter(n => getOrderStatus(n) === 'delivered').length,
    cancelled: orders.filter(n => getOrderStatus(n) === 'cancelled').length,
  };

  const isPrivileged = isOwner || isManager || isSuperAdmin;
  const canBypassJornada = isOwner || isSuperAdmin;

  if (!canBypassJornada && jornadaLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!canBypassJornada && !jornadaActiva) {
    return (
      <AppLayout>
        <SinJornadaActiva />
      </AppLayout>
    );
  }

  if (!canBypassJornada && jornadaActiva && jornada?.metodo_apertura !== 'manual_gerente') {
    return (
      <AppLayout>
        <SinJornadaAutorizada />
      </AppLayout>
    );
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Enlace copiado' });
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
          {(['all', 'new', 'confirmed', 'in_transit', 'delivered', 'cancelled'] as const).map(key => (
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
                      <span className="text-sm font-bold">${Number(meta.subtotal || 0).toFixed(2)}</span>
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
                            <span className="font-medium">${Number(item.total).toFixed(2)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm font-bold pt-2 border-t border-border">
                          <span>Total</span>
                          <span>${Number(meta.subtotal || 0).toFixed(2)}</span>
                        </div>
                      </div>

                      {meta.notes && (
                        <p className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">📝 {meta.notes}</p>
                      )}

                      {/* Actions by status */}
                      {status === 'new' && (
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
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => updateOrderStatus(order.id, 'in_transit')} className="flex-1">
                            <Truck className="h-3.5 w-3.5 mr-1" /> En camino
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => updateOrderStatus(order.id, 'delivered')}>
                            <CheckCircle className="h-3.5 w-3.5 mr-1" /> Entregado
                          </Button>
                        </div>
                      )}
                      {status === 'in_transit' && (
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

      {/* Review request dialog */}
      <Dialog open={reviewDialog.open} onOpenChange={(open) => setReviewDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-4 w-4" /> Solicitar reseña
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Comparte este enlace o QR con <strong>{reviewDialog.customerName}</strong> para que deje su reseña.
            </p>
            
            {/* QR Code */}
            <div className="flex justify-center">
              <div className="p-4 bg-white rounded-xl inline-block">
                <QRCodeSVG value={reviewDialog.url} size={160} />
              </div>
            </div>

            {/* Copy link */}
            <div className="flex gap-2">
              <input
                readOnly
                value={reviewDialog.url}
                className="flex-1 h-9 px-3 rounded-lg border border-border bg-muted text-xs font-mono truncate"
              />
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(reviewDialog.url)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Orders;
