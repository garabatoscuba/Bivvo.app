import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useResolvedBusinessId } from '@/hooks/useResolvedBusinessId';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar, Percent, DollarSign, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

type CostMethod = 'direct' | 'indirect_pct' | 'real_expenses';

interface Props {
  product: {
    id: string;
    cost_price: number;
    sale_price: number;
    cost_method?: string;
    indirect_cost_percentage?: number;
    indirect_cost_amount?: number;
  };
  onCostUpdate: (adjustedCost: number) => void;
  onSaved: () => void;
}

const METHOD_OPTIONS: { value: CostMethod; label: string; icon: typeof DollarSign; desc: string }[] = [
  { value: 'direct', label: 'Solo costo directo', icon: DollarSign, desc: 'Sin costos indirectos' },
  { value: 'indirect_pct', label: '% fijo de indirectos', icon: Percent, desc: 'Suma un porcentaje al costo base' },
  { value: 'real_expenses', label: 'Gastos reales', icon: Calendar, desc: 'Prorrateo proporcional del período' },
];

export default function CostMethodSection({ product, onCostUpdate, onSaved }: Props) {
  const { businessId } = useResolvedBusinessId();
  const [method, setMethod] = useState<CostMethod>((product.cost_method as CostMethod) || 'direct');
  const [pct, setPct] = useState(product.indirect_cost_percentage ?? 0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [realAmount, setRealAmount] = useState(product.indirect_cost_amount ?? 0);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [saving, setSaving] = useState(false);

  const baseCost = product.cost_price || 0;

  // Compute adjusted cost based on method
  const adjustedCost = useMemo(() => {
    if (method === 'indirect_pct') return baseCost * (1 + (pct || 0) / 100);
    if (method === 'real_expenses') return baseCost + (realAmount || 0);
    return baseCost;
  }, [method, baseCost, pct, realAmount]);

  // Notify parent of cost change for live margin recalculation
  useEffect(() => {
    onCostUpdate(adjustedCost);
  }, [adjustedCost]);

  // Fetch real expenses when dates change
  useEffect(() => {
    if (method !== 'real_expenses' || !dateFrom || !dateTo || !businessId) return;

    const fetchExpenses = async () => {
      setLoadingExpenses(true);
      try {
        const expRes = await supabase
          .from('accounting_expenses')
          .select('amount')
          .eq('business_id', businessId!)
          .eq('status', 'paid')
          .gte('paid_at', dateFrom)
          .lte('paid_at', dateTo + 'T23:59:59');

        const tresRes = await supabase
          .from('treasury_movements')
          .select('amount')
          .eq('business_id', businessId!)
          .gte('created_at', dateFrom)
          .lte('created_at', dateTo + 'T23:59:59');

        const prodsRes = await supabase
          .from('products')
          .select('id, cost_price')
          .eq('business_id', businessId!)
          .eq('status', 'for_sale');

        const totalExpenses =
          (expRes.data || []).reduce((s, e) => s + Number(e.amount || 0), 0) +
          (tresRes.data || []).reduce((s, e) => s + Math.abs(Number(e.amount || 0)), 0);

        const allProducts = prodsRes.data || [];
        const totalCost = allProducts.reduce((s, p) => s + Number(p.cost_price || 0), 0);

        if (totalCost > 0) {
          const share = (baseCost / totalCost) * totalExpenses;
          setRealAmount(Math.round(share * 100) / 100);
        } else {
          setRealAmount(0);
        }
      } catch (err) {
        console.error('Error fetching expenses:', err);
      } finally {
        setLoadingExpenses(false);
      }
    };

    fetchExpenses();
  }, [method, dateFrom, dateTo, businessId, baseCost]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        cost_method: method,
        indirect_cost_percentage: method === 'indirect_pct' ? pct : 0,
        indirect_cost_amount: method === 'real_expenses' ? realAmount : 0,
      };

      const { error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', product.id);

      if (error) throw error;
      toast({ title: 'Método de costo guardado' });
      onSaved();
    } catch (err: any) {
      toast({ title: 'Error al guardar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const margin = product.sale_price > 0
    ? ((product.sale_price - adjustedCost) / product.sale_price * 100)
    : 0;

  const isDirty =
    method !== ((product.cost_method as CostMethod) || 'direct') ||
    (method === 'indirect_pct' && pct !== (product.indirect_cost_percentage ?? 0)) ||
    (method === 'real_expenses' && realAmount !== (product.indirect_cost_amount ?? 0));

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <p className="text-sm font-semibold">Método de costo</p>

      {/* Method selector */}
      <div className="grid grid-cols-1 gap-2">
        {METHOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setMethod(opt.value)}
            className={cn(
              'flex items-center gap-3 rounded-lg border p-3 text-left transition-colors',
              method === opt.value
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-muted/50'
            )}
          >
            <opt.icon className={cn('h-4 w-4 flex-shrink-0', method === opt.value ? 'text-primary' : 'text-muted-foreground')} />
            <div className="min-w-0">
              <p className="text-sm font-medium">{opt.label}</p>
              <p className="text-xs text-muted-foreground">{opt.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Indirect percentage input */}
      {method === 'indirect_pct' && (
        <div className="space-y-1.5">
          <Label className="text-xs">Porcentaje de costos indirectos</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={pct}
              onChange={(e) => setPct(Number(e.target.value))}
              className="w-28"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </div>
      )}

      {/* Real expenses date range */}
      {method === 'real_expenses' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
          {loadingExpenses && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Calculando prorrateo…
            </p>
          )}
          {!loadingExpenses && realAmount > 0 && (
            <p className="text-xs text-muted-foreground">
              Costo indirecto asignado: <span className="font-semibold text-foreground">${realAmount.toFixed(2)}</span>
            </p>
          )}
        </div>
      )}

      {/* Live preview */}
      {method !== 'direct' && (
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Costo ajustado</p>
            <p className="text-lg font-bold">${adjustedCost.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Margen ajustado</p>
            <p className={cn('text-lg font-bold', margin >= 30 ? 'text-green-600' : margin >= 10 ? 'text-yellow-600' : 'text-red-600')}>
              {margin.toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      {/* Save button */}
      {isDirty && (
        <Button onClick={handleSave} disabled={saving} size="sm" className="w-full">
          {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-2 h-3.5 w-3.5" />}
          Guardar método de costo
        </Button>
      )}
    </div>
  );
}
