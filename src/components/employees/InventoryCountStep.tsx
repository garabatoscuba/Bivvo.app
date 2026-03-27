import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, PackageCheck, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { toast } from 'sonner';

interface InventoryCountStepProps {
  businessId: string;
  branchId: string;
  shiftId: string;
  onComplete: () => void;
}

interface ProductStock {
  product_id: string;
  product_name: string;
  unit: string;
  system_stock: number;
}

const InventoryCountStep = ({ businessId, branchId, shiftId, onComplete }: InventoryCountStepProps) => {
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const { user, isOperator: isOperatorRole } = useAuth();
  const auditLog = useAuditLog();

  // Resolve operator status from employee record (position fallback)
  const { data: employeeForOperator } = useQuery({
    queryKey: ['inventory-count-employee', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('employees')
        .select('id, position')
        .eq('auth_user_id', user.id)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const isOperatorByPosition = ['operator', 'operario', 'operario de área'].includes(
    (employeeForOperator?.position || '').toLowerCase().trim()
  );
  const isOperator = isOperatorRole || isOperatorByPosition;

  // For operators, fetch their assigned insumo areas
  const { data: operatorAreaIds = [] } = useQuery({
    queryKey: ['operator-areas', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const empId = employeeForOperator?.id;
      if (!empId) {
        const { data: emp } = await supabase
          .from('employees')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        if (!emp) return [];
        const { data } = await supabase
          .from('employee_insumo_areas')
          .select('insumo_area_id')
          .eq('employee_id', emp.id);
        return (data || []).map(d => d.insumo_area_id).filter(Boolean) as string[];
      }
      const { data } = await supabase
        .from('employee_insumo_areas')
        .select('insumo_area_id')
        .eq('employee_id', empId);
      return (data || []).map(d => d.insumo_area_id).filter(Boolean) as string[];
    },
    enabled: isOperator && !!user?.id,
  });

  // Operator: fetch raw materials from assigned areas
  const { data: operatorInsumos, isLoading: loadingInsumos } = useQuery({
    queryKey: ['operator-insumo-count', operatorAreaIds],
    queryFn: async (): Promise<ProductStock[]> => {
      if (!operatorAreaIds.length) return [];
      const query = supabase
        .from('raw_materials')
        .select('id, name, unidad_medida, stock_vendedor, stock_almacen, insumo_area_id');
      const { data } = await (query as any).in('insumo_area_id', operatorAreaIds);
      if (!data) return [];
      return (data as any[]).map((row: any) => ({
        product_id: row.id,
        product_name: row.name || 'Insumo',
        unit: row.unidad_medida || 'Unidad',
        system_stock: Number(row.stock_vendedor || 0) + Number(row.stock_almacen || 0),
      }));
    },
    enabled: isOperator && operatorAreaIds.length > 0,
  });

  // Regular: fetch products with stock for branch
  const { data: products, isLoading: loadingProducts } = useQuery({
    queryKey: ['inventory-count-products', branchId],
    queryFn: async (): Promise<ProductStock[]> => {
      const { data } = await supabase
        .from('branch_stock')
        .select('product_id, quantity, products!inner(name, unit_of_measure)')
        .eq('branch_id', branchId)
        .gt('quantity', 0);

      if (!data) return [];
      return data.map((row: any) => ({
        product_id: row.product_id,
        product_name: row.products?.name || 'Producto',
        unit: row.products?.unit_of_measure || 'Pieza',
        system_stock: Number(row.quantity) || 0,
      }));
    },
    enabled: !isOperator,
  });

  const isLoading = isOperator ? loadingInsumos : loadingProducts;
  const countItems = isOperator ? (operatorInsumos || []) : (products || []);

  const results = useMemo(() => {
    if (!countItems.length) return [];
    return countItems.map(p => {
      const raw = counts[p.product_id];
      const counted = raw !== undefined && raw !== '' ? Number(raw) : null;
      const diff = counted !== null ? counted - p.system_stock : null;
      return { ...p, counted, diff };
    });
  }, [countItems, counts]);

  const allCounted = results.length > 0 && results.every(r => r.counted !== null);
  const hasDifferences = results.some(r => r.diff !== null && r.diff !== 0);
  const hasShortage = results.some(r => r.diff !== null && r.diff < 0);

  const handleConfirm = async () => {
    setSaving(true);

    try {
      if (user?.id && countItems.length > 0 && results.length > 0) {
        const rows = results
          .filter(r => r.counted !== null)
          .map(r => ({
            business_id: businessId,
            branch_id: branchId,
            user_id: user.id,
            shift_id: shiftId,
            product_id: r.product_id,
            system_stock: r.system_stock,
            counted_stock: r.counted!,
            difference: r.diff!,
          }));

        if (rows.length > 0) {
          await supabase.from('inventory_counts' as any).insert(rows);
        }

        // Audit log for each shortage
        const shortages = results.filter(r => r.diff !== null && r.diff < 0);
        for (const s of shortages) {
          auditLog(
            'shrinkage_registered',
            `Diferencia en conteo de cierre: ${Math.abs(s.diff!)} unidades de ${s.product_name}`,
            s.product_id,
            'product'
          );
        }
      }
    } catch (e) {
      console.error('Error saving inventory count:', e);
    }

    setSaving(false);
    onComplete();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (countItems.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/30 p-6 text-center space-y-2">
          <PackageCheck className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {isOperator ? 'No hay insumos en tus áreas asignadas para contar.' : 'No hay productos con stock en venta para contar.'}
          </p>
        </div>
        <Button onClick={onComplete} className="w-full gap-2">
          Continuar <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ScrollArea className="h-[46dvh] sm:h-[50vh]">
        <div className="space-y-2 pr-2">
          {results.map(r => (
            <div
              key={r.product_id}
              className="flex items-center gap-3 rounded-lg border border-border p-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.product_name}</p>
                <p className="text-xs text-muted-foreground">
                  Sistema: {r.system_stock} {r.unit}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  placeholder="0"
                  className="w-20 h-9 text-center"
                  value={counts[r.product_id] ?? ''}
                  onChange={e => setCounts(prev => ({ ...prev, [r.product_id]: e.target.value }))}
                />
                {r.diff !== null && (
                  <span
                    className={`text-xs font-semibold whitespace-nowrap min-w-[70px] text-right ${
                      r.diff === 0
                        ? 'text-green-600 dark:text-green-400'
                        : r.diff > 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-destructive'
                    }`}
                  >
                    {r.diff === 0
                      ? '✓ Cuadra'
                      : r.diff > 0
                      ? `+${r.diff} sobrante`
                      : `${r.diff} faltante`}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Status banner */}
      {allCounted && (
        <div
          className={`rounded-md p-3 text-sm flex items-center gap-2 ${
            hasDifferences
              ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-700 dark:text-yellow-400'
              : 'bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400'
          }`}
        >
          {hasDifferences ? (
            <>
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Hay diferencias en el conteo. Quedan registradas para revisión del dueño.
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Inventario cuadrado ✓
            </>
          )}
        </div>
      )}

      <Button
        onClick={handleConfirm}
        disabled={!allCounted || saving}
        className="w-full gap-2"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowRight className="h-4 w-4" />
        )}
        Confirmar conteo y continuar
      </Button>
    </div>
  );
};

export default InventoryCountStep;
