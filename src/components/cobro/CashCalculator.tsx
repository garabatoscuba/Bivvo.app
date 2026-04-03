import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calculator, Coins, ArrowRightLeft, Wrench, Package, Gift } from 'lucide-react';

const BILL_DENOMINATIONS = [1, 3, 5, 10, 20, 50, 100, 200, 500, 1000];

interface CashCalculatorProps {
  employeeBusinessId?: string;
  employeeBranchId?: string | null;
  employeeModalityType?: string;
  onTipSurplusChange?: (surplus: number) => void;
  onBreakdownChange?: (breakdown: any) => void;
}

const CashCalculator = ({ employeeBusinessId, employeeBranchId, onTipSurplusChange, onBreakdownChange }: CashCalculatorProps) => {
  const { profile } = useAuth();
  const businessId = employeeBusinessId || profile?.business_id;
  const branchId = employeeBranchId || profile?.branch_id;
  const todayStr = new Date().toISOString().split('T')[0];

  const [bills, setBills] = useState<Record<number, number>>(
    Object.fromEntries(BILL_DENOMINATIONS.map(d => [d, 0]))
  );

  const handleBillChange = (denom: number, qty: number) => {
    setBills(prev => ({ ...prev, [denom]: isNaN(qty) ? 0 : qty }));
  };

  const totalCash = BILL_DENOMINATIONS.reduce((sum, d) => sum + d * (bills[d] || 0), 0);

  // Fetch today's service entries with payment types
  const { data: todayServices = [] } = useQuery({
    queryKey: ['calculator-services-today', businessId, branchId, todayStr],
    queryFn: async () => {
      const startOfDay = todayStr + 'T00:00:00';
      const endOfDay = todayStr + 'T23:59:59';
      const { data, error } = await supabase
        .from('service_entries')
        .select('amount, payment_type')
        .eq('business_id', businessId!)
        .eq('branch_id', branchId!)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay);
      if (error) throw error;
      return data;
    },
    enabled: !!businessId && !!branchId,
  });

  // Fetch today's sales with payment types
  const { data: todaySales = [] } = useQuery({
    queryKey: ['calculator-sales-today', branchId, todayStr],
    queryFn: async () => {
      const startOfDay = todayStr + 'T00:00:00';
      const endOfDay = todayStr + 'T23:59:59';
      const { data, error } = await supabase
        .from('sales')
        .select('id, payment_type, total, cash_amount, transfer_amount')
        .eq('branch_id', branchId!)
        .eq('status', 'completed')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay);
      if (error) throw error;
      return data;
    },
    enabled: !!branchId,
  });

  // Fetch jornadas to count active workers
  const { data: todayJornadas = [] } = useQuery({
    queryKey: ['calculator-jornadas-today', branchId, todayStr],
    queryFn: async () => {
      const startOfDay = todayStr + 'T00:00:00';
      const endOfDay = todayStr + 'T23:59:59';
      const { data, error } = await supabase
        .from('jornadas')
        .select('empleado_id')
        .eq('sucursal_id', branchId!)
        .gte('apertura_at', startOfDay)
        .lte('apertura_at', endOfDay);
      if (error) throw error;
      return data;
    },
    enabled: !!branchId,
  });

  const breakdown = useMemo(() => {
    const serviceCash = todayServices.filter(s => s.payment_type === 'cash').reduce((sum, s) => sum + Number(s.amount), 0);
    const serviceTransfer = todayServices.filter(s => s.payment_type === 'transfer').reduce((sum, s) => sum + Number(s.amount), 0);
    const serviceTotal = serviceCash + serviceTransfer;

    // Include mixed payments: their cash_amount goes to cash, transfer_amount goes to transfer
    const salesCash = todaySales.reduce((sum, s) => {
      if (s.payment_type === 'cash') return sum + Number(s.total);
      if (s.payment_type === 'mixed') return sum + Number((s as any).cash_amount || 0);
      return sum;
    }, 0);
    const salesTransfer = todaySales.reduce((sum, s) => {
      if (s.payment_type === 'transfer') return sum + Number(s.total);
      if (s.payment_type === 'mixed') return sum + Number((s as any).transfer_amount || 0);
      return sum;
    }, 0);
    const salesTotal = todaySales.reduce((sum, s) => {
      if (['cash', 'transfer', 'mixed'].includes(s.payment_type)) return sum + Number(s.total);
      return sum;
    }, 0);

    const totalAllTransfers = serviceTransfer + salesTransfer;
    const totalExpectedCash = serviceCash + salesCash;
    const totalSalesDay = serviceTotal + salesTotal;

    const activeWorkers = new Set(todayJornadas.map(j => j.empleado_id)).size;

    // Tips = cash counted - expected cash
    const tips = Math.max(0, totalCash - totalExpectedCash);
    const tipsPerWorker = activeWorkers > 0 ? tips / activeWorkers : tips;

    return {
      serviceCash, serviceTransfer, serviceTotal,
      salesCash, salesTransfer, salesTotal,
      totalAllTransfers,
      totalExpectedCash, totalSalesDay,
      tips, tipsPerWorker, activeWorkers,
    };
  }, [todayServices, todaySales, todayJornadas, totalCash]);

  useEffect(() => {
    onTipSurplusChange?.(breakdown.tips);
    onBreakdownChange?.({
      totalCash,
      serviceCash: breakdown.serviceCash,
      serviceTransfer: breakdown.serviceTransfer,
      serviceTotal: breakdown.serviceTotal,
      salesCash: breakdown.salesCash,
      salesTransfer: breakdown.salesTransfer,
      salesTotal: breakdown.salesTotal,
      totalAllTransfers: breakdown.totalAllTransfers,
      totalExpectedCash: breakdown.totalExpectedCash,
      totalSalesDay: breakdown.totalSalesDay,
      tips: breakdown.tips,
    });
  }, [breakdown.tips, onTipSurplusChange, onBreakdownChange, totalCash, breakdown]);
  return (
    <div className="space-y-4">
      {/* Cash counter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Conteo de Efectivo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-1 text-xs font-medium text-muted-foreground border-b pb-1.5">
            <span>Billete</span>
            <span className="text-center">Cantidad</span>
            <span className="text-right">Total</span>
          </div>
          {BILL_DENOMINATIONS.map(denom => (
            <div key={denom} className="grid grid-cols-3 gap-1 items-center">
              <span className="text-sm font-medium">${denom}</span>
              <Input
                type="number"
                min={0}
                value={bills[denom] || ''}
                onChange={e => handleBillChange(denom, parseInt(e.target.value))}
                className="h-8 text-center text-sm"
                placeholder="0"
              />
              <span className="text-sm font-bold text-right">${(denom * (bills[denom] || 0)).toLocaleString()}</span>
            </div>
          ))}
          <div className="border-t pt-2 flex items-center justify-between">
            <span className="text-sm font-semibold flex items-center gap-1">
              <Coins className="h-4 w-4" /> Total Efectivo
            </span>
            <span className="text-lg font-bold text-primary">${totalCash.toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      {/* Transfers breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Transferencias del Día
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Wrench className="h-3.5 w-3.5" /> Servicios
            </span>
            <span className="font-medium">${breakdown.serviceTransfer.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Package className="h-3.5 w-3.5" /> Punto de Venta
            </span>
            <span className="font-medium">${breakdown.salesTransfer.toFixed(2)}</span>
          </div>
          <div className="border-t pt-2 flex justify-between">
            <span className="text-sm font-bold">Total Transferencias</span>
            <span className="text-lg font-bold text-primary">${breakdown.totalAllTransfers.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Day summary & tips */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resumen del Día</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Venta servicios</span>
            <span>${breakdown.serviceTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Venta productos</span>
            <span>${breakdown.salesTotal.toFixed(2)}</span>
          </div>
          <div className="border-t pt-2 flex justify-between">
            <span className="text-sm font-bold">Venta Total del Día</span>
            <span className="font-bold">${breakdown.totalSalesDay.toFixed(2)}</span>
          </div>

          <div className="border-t pt-2 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Efectivo esperado en caja</span>
              <span>${breakdown.totalExpectedCash.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Efectivo contado</span>
              <span>${totalCash.toFixed(2)}</span>
            </div>
          </div>

          <div className="border-t pt-2 flex justify-between items-center">
            <span className="text-sm font-bold flex items-center gap-1">
              <Gift className="h-4 w-4 text-accent-foreground" /> Propinas
            </span>
            <div className="text-right">
              <span className="text-lg font-bold text-accent-foreground">${breakdown.tips.toFixed(2)}</span>
              {breakdown.activeWorkers > 1 && (
                <p className="text-xs text-muted-foreground">
                  ${breakdown.tipsPerWorker.toFixed(2)} c/u ({breakdown.activeWorkers} trab.)
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-primary/10 p-3 flex justify-between items-center">
            <span className="text-sm font-bold">Efectivo + Transferencias</span>
            <span className="text-xl font-bold text-primary">
              ${(totalCash + breakdown.totalAllTransfers).toFixed(2)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CashCalculator;
