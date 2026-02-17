import { useState } from 'react';
import { useInventoryMovements } from '@/hooks/useInventoryMovements';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, ArrowDownCircle, ArrowUpCircle, ArrowRightLeft, PackageX, RotateCcw, Wrench, ShoppingCart, Calendar, User, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MovementsLogProps {
  branchId: string;
}

const movementConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  purchase: { label: 'Compra / Entrada', icon: ArrowDownCircle, className: 'bg-success/15 text-success' },
  sale: { label: 'Venta', icon: ShoppingCart, className: 'bg-primary/15 text-primary' },
  transfer_in: { label: 'Transferencia entrada', icon: ArrowDownCircle, className: 'bg-info/15 text-info' },
  transfer_out: { label: 'Transferencia salida', icon: ArrowUpCircle, className: 'bg-warning/15 text-warning' },
  loss: { label: 'Pérdida', icon: PackageX, className: 'bg-destructive/15 text-destructive' },
  adjustment: { label: 'Ajuste', icon: Wrench, className: 'bg-muted text-muted-foreground' },
  return: { label: 'Devolución', icon: RotateCcw, className: 'bg-accent text-accent-foreground' },
};

export const MovementsLog = ({ branchId }: MovementsLogProps) => {
  const { data: movements, isLoading } = useInventoryMovements(branchId);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filtered = (movements || []).filter(m => {
    const matchesSearch = !search ||
      m.product?.name?.toLowerCase().includes(search.toLowerCase()) ||
      m.product?.code?.toLowerCase().includes(search.toLowerCase()) ||
      m.user_profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.notes?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || m.movement_type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Group by date
  const grouped = new Map<string, typeof filtered>();
  filtered.forEach(m => {
    const dateKey = format(new Date(m.created_at), 'yyyy-MM-dd');
    const arr = grouped.get(dateKey) || [];
    arr.push(m);
    grouped.set(dateKey, arr);
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar producto, persona..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="purchase">Compra / Entrada</SelectItem>
            <SelectItem value="sale">Venta</SelectItem>
            <SelectItem value="transfer_in">Trans. entrada</SelectItem>
            <SelectItem value="transfer_out">Trans. salida</SelectItem>
            <SelectItem value="loss">Pérdida</SelectItem>
            <SelectItem value="adjustment">Ajuste</SelectItem>
            <SelectItem value="return">Devolución</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{filtered.length} movimiento{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Movements grouped by date */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ArrowRightLeft className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold">No hay movimientos</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {search || typeFilter !== 'all' ? 'No se encontraron resultados' : 'Los movimientos aparecerán aquí cuando realices operaciones de inventario'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([dateKey, dayMovements]) => (
            <div key={dateKey}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {format(new Date(dateKey), "EEEE, d 'de' MMMM yyyy", { locale: es })}
                </span>
              </div>
              <div className="space-y-1">
                {dayMovements.map(m => {
                  const config = movementConfig[m.movement_type] || movementConfig.adjustment;
                  const Icon = config.icon;
                  const time = format(new Date(m.created_at), 'HH:mm', { locale: es });

                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors"
                    >
                      {/* Icon */}
                      <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0', config.className)}>
                        <Icon className="h-4 w-4" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{m.product?.name || 'Producto eliminado'}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0">
                            {m.product?.code || '—'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {m.user_profile?.full_name || 'Usuario'}
                          </span>
                          <span>{time}</span>
                          {m.notes && (
                            <span className="truncate max-w-[200px]" title={m.notes}>
                              {m.notes}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quantity & Type */}
                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className={cn(
                          'text-sm font-bold tabular-nums',
                          ['purchase', 'transfer_in', 'return'].includes(m.movement_type) ? 'text-success' : 'text-destructive'
                        )}>
                          {['purchase', 'transfer_in', 'return'].includes(m.movement_type) ? '+' : '−'}{m.quantity}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{config.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
