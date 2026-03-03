import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, PackageX, Loader2, Calendar, User, Filter, Plus } from 'lucide-react';
import { format, isToday, isAfter, subDays, subWeeks, subMonths, isThisMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const REASON_LABELS: Record<string, string> = {
  vencimiento: 'Vencimiento',
  dano: 'Daño',
  robo: 'Robo',
  uso_interno: 'Uso interno',
  otro: 'Otro',
};

const REASON_COLORS: Record<string, string> = {
  vencimiento: 'bg-warning/15 text-warning',
  dano: 'bg-destructive/15 text-destructive',
  robo: 'bg-destructive/20 text-destructive',
  uso_interno: 'bg-info/15 text-info',
  otro: 'bg-muted text-muted-foreground',
};

type DateFilter = 'all' | 'today' | '3days' | '7days' | 'month' | '3months';

const dateFilterLabels: Record<DateFilter, string> = {
  all: 'Todo',
  today: 'Hoy',
  '3days': '3 días',
  '7days': '7 días',
  month: 'Este mes',
  '3months': '3 meses',
};

function extractReason(notes: string | null): string {
  if (!notes) return 'otro';
  const match = notes.match(/^Merma:\s*(\S+)/i);
  if (!match) return 'otro';
  const r = match[1].toLowerCase();
  if (r.includes('vencimiento')) return 'vencimiento';
  if (r.includes('daño') || r.includes('dano')) return 'dano';
  if (r.includes('robo')) return 'robo';
  if (r.includes('uso')) return 'uso_interno';
  return 'otro';
}

function extractExtraNotes(notes: string | null): string {
  if (!notes) return '';
  const idx = notes.indexOf('—');
  return idx > -1 ? notes.substring(idx + 1).trim() : '';
}

interface MermasTabProps {
  branchId: string;
  onRegisterMerma: () => void;
}

export const MermasTab = ({ branchId, onRegisterMerma }: MermasTabProps) => {
  const { profile, isOwner, isManager } = useAuth();
  const canSeeAll = isOwner || isManager;

  const [search, setSearch] = useState('');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');

  const { data: movements, isLoading } = useQuery({
    queryKey: ['mermas', branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_movements')
        .select('*')
        .eq('branch_id', branchId)
        .eq('movement_type', 'loss')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;

      const productIds = [...new Set(data.map(m => m.product_id))];
      const userIds = [...new Set(data.map(m => m.user_id))];

      const [productsRes, profilesRes] = await Promise.all([
        supabase.from('products').select('id, name, code, cost_price').in('id', productIds),
        supabase.from('profiles').select('user_id, full_name').in('user_id', userIds),
      ]);

      const productMap = new Map(productsRes.data?.map(p => [p.id, p]) || []);
      const profileMap = new Map(profilesRes.data?.map(p => [p.user_id, p]) || []);

      return data.map(m => ({
        ...m,
        product: productMap.get(m.product_id) || null,
        user_profile: profileMap.get(m.user_id) || null,
      }));
    },
    enabled: !!branchId,
  });

  const filtered = useMemo(() => {
    return (movements || []).filter(m => {
      // Employee can only see own
      if (!canSeeAll && m.user_id !== profile?.user_id) return false;

      const reason = extractReason(m.notes);
      const matchesSearch = !search ||
        m.product?.name?.toLowerCase().includes(search.toLowerCase()) ||
        m.product?.code?.toLowerCase().includes(search.toLowerCase()) ||
        m.user_profile?.full_name?.toLowerCase().includes(search.toLowerCase());
      const matchesReason = reasonFilter === 'all' || reason === reasonFilter;

      let matchesDate = true;
      if (dateFilter !== 'all') {
        const date = new Date(m.created_at);
        switch (dateFilter) {
          case 'today': matchesDate = isToday(date); break;
          case '3days': matchesDate = isAfter(date, subDays(new Date(), 3)); break;
          case '7days': matchesDate = isAfter(date, subWeeks(new Date(), 1)); break;
          case 'month': matchesDate = isThisMonth(date); break;
          case '3months': matchesDate = isAfter(date, subMonths(new Date(), 3)); break;
        }
      }

      return matchesSearch && matchesReason && matchesDate;
    });
  }, [movements, search, reasonFilter, dateFilter, canSeeAll, profile?.user_id]);

  const totalLostValue = useMemo(() => {
    return filtered.reduce((sum, m) => {
      const cost = Number(m.product?.cost_price || 0);
      return sum + cost * m.quantity;
    }, 0);
  }, [filtered]);

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    filtered.forEach(m => {
      const key = format(new Date(m.created_at), 'yyyy-MM-dd');
      const arr = map.get(key) || [];
      arr.push(m);
      map.set(key, arr);
    });
    return map;
  }, [filtered]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Register button */}
      <Button onClick={onRegisterMerma} variant="destructive" size="sm" className="w-full sm:w-auto">
        <Plus className="h-4 w-4 mr-1.5" />
        Registrar merma
      </Button>

      {/* Date filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        {(Object.entries(dateFilterLabels) as [DateFilter, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setDateFilter(key)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors border',
              dateFilter === key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:bg-muted'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search + reason filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar producto, persona..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={reasonFilter} onValueChange={setReasonFilter}>
          <SelectTrigger className="w-36">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue placeholder="Motivo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="vencimiento">Vencimiento</SelectItem>
            <SelectItem value="dano">Daño</SelectItem>
            <SelectItem value="robo">Robo</SelectItem>
            <SelectItem value="uso_interno">Uso interno</SelectItem>
            <SelectItem value="otro">Otro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{filtered.length} merma{filtered.length !== 1 ? 's' : ''}</span>
        <span className="font-medium text-destructive">Valor perdido: ${totalLostValue.toFixed(2)}</span>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <PackageX className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold">No hay mermas</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {search || reasonFilter !== 'all' || dateFilter !== 'all'
              ? 'No se encontraron resultados para este filtro'
              : 'Las mermas aparecerán aquí cuando se registren'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([dateKey, items]) => (
            <div key={dateKey}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {format(new Date(dateKey), "EEEE, d 'de' MMMM yyyy", { locale: es })}
                </span>
              </div>
              <div className="space-y-1">
                {items.map(m => {
                  const reason = extractReason(m.notes);
                  const extraNotes = extractExtraNotes(m.notes);
                  const reasonColor = REASON_COLORS[reason] || REASON_COLORS.otro;
                  const costValue = Number(m.product?.cost_price || 0) * m.quantity;

                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0', reasonColor)}>
                        <PackageX className="h-4 w-4" />
                      </div>
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
                          <span>{format(new Date(m.created_at), 'HH:mm', { locale: es })}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {REASON_LABELS[reason] || reason}
                          </Badge>
                          {extraNotes && (
                            <span className="truncate max-w-[150px]" title={extraNotes}>{extraNotes}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className="text-sm font-bold tabular-nums text-destructive">−{m.quantity}</span>
                        <span className="text-[10px] text-muted-foreground">${costValue.toFixed(2)}</span>
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
