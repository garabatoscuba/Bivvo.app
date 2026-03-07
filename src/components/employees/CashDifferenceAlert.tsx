import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

interface CashDifferenceAlertProps {
  businessId: string;
  branchId: string;
  totalCash: number;
  expectedCashFromSales: number; // serviceCash + salesCash from CashCalculator
  onDifferenceChange: (blocked: boolean) => void;
}

const CashDifferenceAlert = ({
  businessId,
  branchId,
  totalCash,
  expectedCashFromSales,
  onDifferenceChange,
}: CashDifferenceAlertProps) => {
  const { user, profile } = useAuth();
  const auditLog = useAuditLog();
  const notifiedRef = useRef(false);

  // Fetch active cash register for this user + branch
  const { data: activeCashRegister } = useQuery({
    queryKey: ['active-cash-register-closure', branchId, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('cash_registers')
        .select('id, opening_amount')
        .eq('branch_id', branchId)
        .eq('user_id', user!.id)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!branchId && !!user?.id,
  });

  // Fetch cash register withdrawals (movement_type = 'withdrawal')
  const { data: withdrawals = 0 } = useQuery({
    queryKey: ['cash-register-withdrawals', activeCashRegister?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('cash_register_movements')
        .select('amount, movement_type')
        .eq('cash_register_id', activeCashRegister!.id);
      if (!data) return 0;
      // Net: withdrawals subtract, deposits add
      return data.reduce((sum, m) => {
        if (m.movement_type === 'withdrawal') return sum - Number(m.amount);
        if (m.movement_type === 'deposit') return sum + Number(m.amount);
        return sum;
      }, 0);
    },
    enabled: !!activeCashRegister?.id,
  });

  const openingAmount = activeCashRegister?.opening_amount || 0;

  // Expected = opening + sales/service cash + net movements (deposits - withdrawals)
  const expectedCash = openingAmount + expectedCashFromSales + withdrawals;
  const difference = totalCash - expectedCash;
  const isNegative = difference < -1;
  const isPositive = difference > 1;
  const isOk = !isNegative && !isPositive;

  // Notify parent whether closing is blocked
  useEffect(() => {
    onDifferenceChange(isNegative);
  }, [isNegative, onDifferenceChange]);

  // Fetch branch name for notification
  const { data: branchName } = useQuery({
    queryKey: ['branch-name-closure', branchId],
    queryFn: async () => {
      const { data } = await supabase
        .from('branches')
        .select('name')
        .eq('id', branchId)
        .maybeSingle();
      return data?.name || 'sucursal';
    },
    enabled: !!branchId && isNegative,
  });

  // Send notification + audit log once when negative difference detected
  useEffect(() => {
    if (!isNegative || notifiedRef.current || !profile || !branchName) return;
    notifiedRef.current = true;

    const absDiff = Math.abs(difference).toFixed(2);
    const now = new Date().toLocaleString('es');

    // Audit log
    auditLog(
      'cash_register_closed',
      `Intento de cierre con diferencia de -$${absDiff} — bloqueado por el sistema.`,
      activeCashRegister?.id,
      'cash_register'
    );

    // Notification for owners and managers of this branch
    supabase.from('notifications').insert({
      business_id: businessId,
      branch_id: branchId,
      type: 'cash_difference_alert',
      title: '⚠️ Alerta de caja',
      message: `⚠️ Alerta de caja: ${profile.full_name} tiene una diferencia de -$${absDiff} en el cierre de caja de ${branchName}. Fecha: ${now}.`,
      metadata: {
        employee_name: profile.full_name,
        difference: -Math.abs(difference),
        branch_name: branchName,
        date: now,
      },
    });
  }, [isNegative, profile, branchName, difference, auditLog, activeCashRegister?.id, businessId, branchId]);

  // Reset notification flag when difference changes from negative to non-negative
  useEffect(() => {
    if (!isNegative) notifiedRef.current = false;
  }, [isNegative]);

  if (totalCash === 0 && expectedCashFromSales === 0) return null;

  return (
    <div className="px-6 space-y-1">
      {/* Expected vs counted summary */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Fondo apertura: ${openingAmount.toFixed(2)}</span>
        <span>Esperado total: ${expectedCash.toFixed(2)}</span>
      </div>

      {isNegative && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3 space-y-1">
          <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Diferencia: -${Math.abs(difference).toFixed(2)}. El efectivo contado no coincide con lo esperado.
          </div>
          <p className="text-xs text-destructive/80">
            No es posible cerrar la caja con una diferencia negativa. Recontá el efectivo o contactá al encargado.
          </p>
        </div>
      )}

      {isPositive && (
        <div className="rounded-lg border border-yellow-500 bg-yellow-500/10 p-3">
          <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400 font-semibold text-sm">
            <Info className="h-4 w-4 shrink-0" />
            Diferencia positiva: +${difference.toFixed(2)}. Quedará registrada.
          </div>
        </div>
      )}

      {isOk && totalCash > 0 && (
        <div className="rounded-lg border border-green-500 bg-green-500/10 p-3">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-semibold text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Efectivo cuadra ✓
          </div>
        </div>
      )}
    </div>
  );
};

export default CashDifferenceAlert;
