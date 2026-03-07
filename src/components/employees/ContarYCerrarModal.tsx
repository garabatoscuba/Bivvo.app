import { useState, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut, Calculator, DollarSign, Gift, Briefcase, TrendingUp, PackageCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import CashCalculator from '@/components/cobro/CashCalculator';
import { ScrollArea } from '@/components/ui/scroll-area';
import JornadaSummaryBlock from '@/components/employees/JornadaSummaryBlock';
import InventoryCountStep from '@/components/employees/InventoryCountStep';
import CashDifferenceAlert from '@/components/employees/CashDifferenceAlert';

interface DailySalaryBreakdown {
  total: number;
  base: number;
  serviceEarning: number;
  commissionEarning: number;
  tipShare: number;
  [key: string]: any;
}

interface ContarYCerrarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jornada: {
    id: string;
    apertura_at: string;
    empleado_id: string;
    sucursal_id: string;
  };
  employeeBusinessId: string;
  dailySalary?: DailySalaryBreakdown | null;
}

function calcDuration(apertura: string): { text: string; minutes: number } {
  const start = new Date(apertura).getTime();
  const now = Date.now();
  const diffMs = now - start;
  const minutes = Math.floor(diffMs / 60000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return {
    text: h > 0 ? `${h}h ${m}m` : `${m}m`,
    minutes,
  };
}

type ClosureStep = 'inventory' | 'cash';

const ContarYCerrarModal = ({ open, onOpenChange, jornada, employeeBusinessId, dailySalary }: ContarYCerrarModalProps) => {
  const [step, setStep] = useState<ClosureStep>('inventory');
  const [closing, setClosing] = useState(false);
  const [tipSurplus, setTipSurplus] = useState(0);
  const [calculatorBreakdown, setCalculatorBreakdown] = useState<any>(null);
  const [cashBlocked, setCashBlocked] = useState(false);
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();

  const todayStr = new Date().toISOString().split('T')[0];
  const duration = calcDuration(jornada.apertura_at);
  const entryTime = new Date(jornada.apertura_at).toLocaleTimeString('es', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Reset step when modal opens
  const handleOpenChange = (open: boolean) => {
    if (!open) setStep('inventory');
    onOpenChange(open);
  };

  // Fetch active workers count (all unique workers who worked today in this branch)
  const { data: activeWorkersCount = 1 } = useQuery({
    queryKey: ['closure-active-workers', jornada.sucursal_id, todayStr],
    queryFn: async () => {
      const startOfDay = todayStr + 'T00:00:00';
      const endOfDay = todayStr + 'T23:59:59';
      const { data } = await supabase
        .from('jornadas')
        .select('empleado_id')
        .eq('sucursal_id', jornada.sucursal_id)
        .gte('apertura_at', startOfDay)
        .lte('apertura_at', endOfDay);
      const unique = new Set(data?.map(j => j.empleado_id) || []);
      return Math.max(1, unique.size);
    },
    enabled: open,
  });

  // Fetch tip config
  const { data: tipConfig } = useQuery({
    queryKey: ['tip-config-closure', employeeBusinessId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tip_config')
        .select('*')
        .eq('business_id', employeeBusinessId)
        .maybeSingle();
      return data;
    },
    enabled: open && !!employeeBusinessId,
  });

  const handleTipSurplusChange = useCallback((surplus: number) => {
    setTipSurplus(surplus);
  }, []);

  const handleBreakdownChange = useCallback((breakdown: any) => {
    setCalculatorBreakdown(breakdown);
  }, []);

  const handleClose = async () => {
    setClosing(true);

    const bd = calculatorBreakdown;
    const totalCash = bd?.totalCash || 0;

    // Save automatic tip entry if there's a surplus
    if (tipSurplus > 0 && user?.id) {
      await supabase.from('tip_entries').insert({
        business_id: employeeBusinessId,
        branch_id: jornada.sucursal_id,
        user_id: user.id,
        amount: tipSurplus,
        tip_type: 'automatic',
        jornada_id: jornada.id,
        date: todayStr,
        notes: 'Excedente de caja al cierre',
      } as any);
    }

    // Calculate tip share for this worker
    let myTipShare = 0;
    const totalTips = tipSurplus;
    if (tipConfig && totalTips > 0) {
      const ownerPct = Number(tipConfig.owner_percent) || 0;
      const afterOwner = totalTips * ((100 - ownerPct) / 100);
      const conditions = (tipConfig.conditions as unknown as { positions: number; tip_percent: number }[]) || [];
      const matched = conditions.find(c => c.positions === activeWorkersCount)
        || conditions.filter(c => c.positions <= activeWorkersCount).sort((a, b) => b.positions - a.positions)[0]
        || conditions.sort((a, b) => a.positions - b.positions)[0];
      myTipShare = matched ? afterOwner * (matched.tip_percent / 100) : afterOwner / Math.max(1, activeWorkersCount);
    }

    // Save daily report
    if (profile && bd) {
      const totalSalesDay = (bd.serviceTotal || 0) + (bd.salesTotal || 0);
      const moneyToDeliver = totalCash - totalTips;

      const reportData = {
        business_id: employeeBusinessId,
        branch_id: jornada.sucursal_id,
        employee_id: profile.id,
        user_id: profile.user_id,
        date: todayStr,
        active_workers: activeWorkersCount,
        service_percent: 0,
        total_services: bd.serviceTotal || 0,
        total_copies: 0,
        total_commissions: dailySalary?.commissionEarning || 0,
        service_earning: dailySalary?.serviceEarning || 0,
        copies_earning: 0,
        commission_earning: dailySalary?.commissionEarning || 0,
        tips: totalTips,
        total_salary: (dailySalary?.total || 0) + myTipShare,
        cash_counted: totalCash,
        service_cash: bd.serviceCash || 0,
        service_transfer: bd.serviceTransfer || 0,
        sales_cash: bd.salesCash || 0,
        sales_transfer: bd.salesTransfer || 0,
        copies_cash: 0,
        copies_transfer: 0,
        total_expected_cash: bd.totalExpectedCash || 0,
        total_transfers: bd.totalAllTransfers || 0,
        total_sales_day: totalSalesDay,
        money_to_deliver: Math.max(0, moneyToDeliver),
        jornada_id: jornada.id,
      };

      const { error: reportError } = await supabase
        .from('daily_reports')
        .upsert(reportData as any, { onConflict: 'employee_id,date' });

      if (reportError) {
        console.error('Error saving daily report:', reportError);
      }

      // Send notification to owner
      await supabase.from('notifications').insert({
        business_id: employeeBusinessId,
        branch_id: jornada.sucursal_id,
        type: 'daily_report',
        title: `Cierre: ${profile.full_name}`,
        message: `${profile.full_name} cerró jornada. Venta: $${totalSalesDay.toFixed(2)}, Propinas: $${totalTips.toFixed(2)}, Entrega: $${Math.max(0, moneyToDeliver).toFixed(2)}`,
        metadata: {
          employee_name: profile.full_name,
          date: todayStr,
          tips: totalTips,
          cash_counted: totalCash,
          total_sales_day: totalSalesDay,
          money_to_deliver: Math.max(0, moneyToDeliver),
        },
      });
    }

    const salarioTotal = (dailySalary?.total || 0) + myTipShare;

    const { error } = await supabase
      .from('jornadas')
      .update({
        cierre_at: new Date().toISOString(),
        duracion_min: duration.minutes,
        metodo_cierre: 'manual',
        salario_ganado: salarioTotal,
      } as any)
      .eq('id', jornada.id);

    setClosing(false);
    if (error) {
      toast.error('Error al cerrar jornada: ' + error.message);
      return;
    }

    // Insert salary record for Balance Personal
    if (user?.id && salarioTotal > 0) {
      await supabase.from('employee_salary_records' as any).insert({
        business_id: employeeBusinessId,
        branch_id: jornada.sucursal_id,
        employee_user_id: user.id,
        employee_name: profile?.full_name || 'Empleado',
        amount: salarioTotal,
        salary_date: todayStr,
        payment_method: 'pending',
        jornada_id: jornada.id,
      });
    }

    queryClient.invalidateQueries({ queryKey: ['jornada-activa'] });
    queryClient.invalidateQueries({ queryKey: ['jornadas-activas-business'] });
    queryClient.invalidateQueries({ queryKey: ['my-today-tips'] });
    queryClient.invalidateQueries({ queryKey: ['admin-daily-reports'] });
    toast.success('Jornada cerrada. ¡Hasta luego! 👋');
    handleOpenChange(false);
  };

  const stepTitle = step === 'inventory' ? 'Conteo de inventario' : 'Contar y Cerrar Jornada';
  const stepDescription = step === 'inventory'
    ? 'Cuenta los productos físicamente antes de continuar al conteo de efectivo.'
    : 'Cuenta el efectivo y revisa el resumen antes de cerrar tu jornada.';
  const StepIcon = step === 'inventory' ? PackageCheck : Calculator;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <StepIcon className="h-5 w-5" />
            {stepTitle}
          </DialogTitle>
          <DialogDescription>{stepDescription}</DialogDescription>
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
            <span>Entrada: <strong>{entryTime}</strong></span>
            <span>Duración: <strong>{duration.text}</strong></span>
            <span className="ml-auto font-medium">
              Paso {step === 'inventory' ? '1' : '2'} de 2
            </span>
          </div>
        </DialogHeader>

        {step === 'inventory' && (
          <div className="px-6 pb-6">
            <InventoryCountStep
              businessId={employeeBusinessId}
              branchId={jornada.sucursal_id}
              shiftId={jornada.id}
              onComplete={() => setStep('cash')}
            />
          </div>
        )}

        {step === 'cash' && (
          <>
            <ScrollArea className="max-h-[60vh] px-6">
              <CashCalculator
                employeeBusinessId={employeeBusinessId}
                employeeBranchId={jornada.sucursal_id}
                onTipSurplusChange={handleTipSurplusChange}
                onBreakdownChange={handleBreakdownChange}
              />
            </ScrollArea>

            {/* Salary + Tips summary */}
            {dailySalary && (
              <div className="px-6 py-3 border-t space-y-2">
                <h4 className="text-sm font-bold flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-primary" />
                  Resumen Salarial
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {dailySalary.base > 0 && (
                    <div className="flex items-center gap-1">
                      <Briefcase className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Base:</span>
                      <span className="font-semibold">${dailySalary.base.toFixed(2)}</span>
                    </div>
                  )}
                  {dailySalary.serviceEarning > 0 && (
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">% Ventas:</span>
                      <span className="font-semibold">${dailySalary.serviceEarning.toFixed(2)}</span>
                    </div>
                  )}
                  {dailySalary.commissionEarning > 0 && (
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Comisiones:</span>
                      <span className="font-semibold">${dailySalary.commissionEarning.toFixed(2)}</span>
                    </div>
                  )}
                  {(dailySalary.tipShare > 0 || tipSurplus > 0) && (
                    <div className="flex items-center gap-1">
                      <Gift className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Propinas:</span>
                      <span className="font-semibold">${(dailySalary.tipShare + (tipSurplus > 0 ? tipSurplus : 0)).toFixed(2)}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between pt-1 border-t">
                  <span className="text-sm font-bold">Total a ganar:</span>
                  <span className="text-lg font-bold text-primary">
                    ${((dailySalary.total || 0) + (tipSurplus > 0 ? tipSurplus : 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <div className="px-6">
              <JornadaSummaryBlock
                jornadaId={jornada.id}
                aperturaAt={jornada.apertura_at}
                userId={user?.id || ''}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 px-6 pb-6 pt-3 border-t">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleClose} disabled={closing} className="gap-2">
                {closing ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                Cerrar Jornada
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ContarYCerrarModal;
