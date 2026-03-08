import { Bell, PackageX, ShoppingCart, ArrowRightLeft, Check, CheckCheck, Store, XCircle, Trash2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications, type Notification } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

const typeConfig: Record<string, { icon: typeof Bell; className: string; route?: string }> = {
  low_stock: { icon: PackageX, className: 'text-destructive bg-destructive/10', route: '/inventory' },
  sale_cancelled: { icon: ShoppingCart, className: 'text-destructive bg-destructive/10', route: '/sales' },
  sale: { icon: ShoppingCart, className: 'text-primary bg-primary/10', route: '/sales' },
  inventory_movement: { icon: ArrowRightLeft, className: 'text-primary bg-primary/10', route: '/inventory' },
  business_request_approved: { icon: Store, className: 'text-primary bg-primary/10', route: '/' },
  business_request_rejected: { icon: XCircle, className: 'text-destructive bg-destructive/10', route: '/plans' },
  storefront_order: { icon: ShoppingCart, className: 'text-primary bg-primary/10', route: '/orders' },
  treasury_pending: { icon: ArrowRightLeft, className: 'text-primary bg-primary/10', route: '/tesoreria' },
};

function NotificationItem({ notif, onRead, onNavigate }: { notif: Notification; onRead: (id: string) => void; onNavigate: (route: string) => void }) {
  const config = typeConfig[notif.type] || { icon: Bell, className: 'text-muted-foreground bg-muted' };
  const Icon = config.icon;

  const handleClick = () => {
    if (!notif.is_read) onRead(notif.id);
    if (config.route) onNavigate(config.route);
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left flex gap-3 p-3 transition-colors hover:bg-muted/50 ${
        notif.is_read ? 'opacity-60' : ''
      }`}
    >
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.className}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight text-foreground truncate">{notif.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{notif.message}</p>
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: es })}
        </p>
      </div>
      {!notif.is_read && (
        <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
      )}
    </button>
  );
}

export default function NotificationCenter() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
  const navigate = useNavigate();

  const handleNavigate = (route: string) => {
    navigate(route);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Notificaciones</h3>
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={markAllAsRead}>
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar todas
              </Button>
            )}
            {notifications.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-destructive hover:text-destructive" onClick={clearAll}>
                <Trash2 className="h-3.5 w-3.5" />
                Limpiar
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-[360px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Bell className="mb-2 h-8 w-8 opacity-30" />
              <p className="text-sm">Sin notificaciones</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map(n => (
                <NotificationItem key={n.id} notif={n} onRead={markAsRead} onNavigate={handleNavigate} />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
