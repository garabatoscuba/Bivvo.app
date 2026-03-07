import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wallet, TrendingUp, Target, ShieldCheck, FileText,
} from "lucide-react";
import type { Period } from "@/components/ui/period-filter";
import {
  startOfDay, endOfDay, subDays, startOfMonth, endOfMonth,
  subMonths, startOfYear, endOfYear, subYears,
} from "date-fns";

interface Props {
  businessId: string;
  branchId?: string;
  period: Period;
}

function getDateRange(period: Period) {
  const now = new Date();
  switch (period) {
    case "today":
      return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
    case "week":
      return { from: startOfDay(subDays(now, 6)).toISOString(), to: endOfDay(now).toISOString() };
    case "month":
      return { from: startOfMonth(now).toISOString(), to: endOfMonth(now).toISOString() };
    case "year":
      return { from: startOfYear(now).toISOString(), to: endOfYear(now).toISOString() };
  }
}

const fmt = (n: number) =>
  "$" + n.toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function OwnerFinancialCards({ businessId, branchId, period }: Props) {
  const { from, to } = useMemo(() => getDateRange(period), [period]);

  const { data, isLoading } = useQuery({
    queryKey: ["owner-financial-cards", businessId, branchId, period],
    queryFn: async () => {
      // Get branch IDs
      const branchIds = branchId
        ? [branchId]
        : (await supabase.from("branches").select("id").eq("business_id", businessId)).data?.map(b => b.id) || [];

      if (!branchIds.length) return null;

      // Parallel fetches
      const [salesRes, serviceRes, injRes, extRes, salaryRes, fixedExpRes] = await Promise.all([
        // Sales
        supabase.from("sales").select("id, total").eq("status", "completed").in("branch_id", branchIds)
          .gte("created_at", from).lte("created_at", to),
        // Services
        (() => {
          let q = supabase.from("service_entries").select("amount").eq("business_id", businessId)
            .gte("created_at", from).lte("created_at", to);
          if (branchId) q = q.eq("branch_id", branchId);
          return q;
        })(),
        // Injections
        (() => {
          let q = supabase.from("treasury_movements" as any).select("amount").eq("business_id", businessId)
            .eq("movement_type", "inyeccion").gte("created_at", from).lte("created_at", to);
          if (branchId) q = q.eq("branch_id", branchId);
          return q;
        })(),
        // Extractions
        (() => {
          let q = supabase.from("treasury_movements" as any).select("amount").eq("business_id", businessId)
            .eq("movement_type", "extraccion").gte("created_at", from).lte("created_at", to);
          if (branchId) q = q.eq("branch_id", branchId);
          return q;
        })(),
        // Salaries
        (() => {
          let q = supabase.from("employee_salary_records" as any).select("amount").eq("business_id", businessId)
            .gte("created_at", from).lte("created_at", to);
          if (branchId) q = q.eq("branch_id", branchId);
          return q;
        })(),
        // Fixed expenses paid in period
        supabase.from("accounting_expenses").select("amount").eq("business_id", businessId)
          .eq("status", "paid").gte("paid_at", from).lte("paid_at", to),
      ]);

      const sales = salesRes.data || [];
      const totalSales = sales.reduce((s, v) => s + Number(v.total), 0);
      const totalServices = (serviceRes.data || []).reduce((s: number, v: any) => s + Number(v.amount), 0);
      const totalInjections = ((injRes.data as any[]) || []).reduce((s: number, v: any) => s + Number(v.amount), 0);
      const totalExtractions = ((extRes.data as any[]) || []).reduce((s: number, v: any) => s + Number(v.amount), 0);
      const totalSalaries = ((salaryRes.data as any[]) || []).reduce((s: number, v: any) => s + Number(v.amount), 0);
      const totalFixedPaid = (fixedExpRes.data || []).reduce((s, v) => s + Number(v.amount), 0);

      // COGS
      const saleIds = sales.map(s => s.id);
      let cogs = 0;
      for (let i = 0; i < saleIds.length; i += 50) {
        const chunk = saleIds.slice(i, i + 50);
        const { data: items } = await supabase.from("sale_items").select("quantity, cost_price").in("sale_id", chunk);
        cogs += (items || []).reduce((s: number, it: any) => s + Number(it.quantity) * Number(it.cost_price || 0), 0);
      }

      const ingresos = totalSales + totalServices + totalInjections;
      const compromisos = totalSalaries + totalExtractions + totalFixedPaid;
      const disponible = ingresos - compromisos; // Operativo mode

      const margenBruto = ingresos > 0 ? (ingresos - cogs) / ingresos : null;
      const margenNeto = ingresos > 0 ? (ingresos - (cogs + compromisos)) / ingresos : null;

      const totalFixedExpensesPeriod = totalFixedPaid; // gastos fijos pagados en el período
      const puntoEquilibrio = margenBruto && margenBruto > 0
        ? totalFixedExpensesPeriod / margenBruto : null;

      // Current month expenses for "Gastos del mes" & "Liquidez"
      const monthStart = startOfMonth(new Date()).toISOString();
      const monthEnd = endOfMonth(new Date()).toISOString();

      const [paidExpRes, pendingExpRes, overdueExpRes] = await Promise.all([
        supabase.from("accounting_expenses").select("amount").eq("business_id", businessId)
          .eq("status", "paid").gte("paid_at", monthStart).lte("paid_at", monthEnd),
        supabase.from("accounting_expenses").select("amount").eq("business_id", businessId)
          .eq("status", "pending"),
        supabase.from("accounting_expenses").select("amount").eq("business_id", businessId)
          .eq("status", "overdue"),
      ]);

      const gastosPagado = (paidExpRes.data || []).reduce((s, e) => s + Number(e.amount), 0);
      const gastosPendiente = (pendingExpRes.data || []).reduce((s, e) => s + Number(e.amount), 0);
      const gastosVencido = (overdueExpRes.data || []).reduce((s, e) => s + Number(e.amount), 0);

      return {
        disponible,
        margenBruto,
        margenNeto,
        cogs,
        ingresos,
        puntoEquilibrio,
        totalSalesInPeriod: totalSales + totalServices,
        gastosPagado,
        gastosPendiente,
        gastosVencido,
        pendingFixedTotal: gastosPendiente + gastosVencido,
      };
    },
    enabled: !!businessId,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}><CardContent className="p-3 md:p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const {
    disponible, margenBruto, margenNeto, cogs, puntoEquilibrio,
    totalSalesInPeriod, gastosPagado, gastosPendiente, gastosVencido,
    pendingFixedTotal,
  } = data;

  // Color helpers
  const margenNetoColor = margenNeto === null ? "text-muted-foreground"
    : margenNeto > 0.10 ? "text-green-600 dark:text-green-400"
    : margenNeto >= 0.05 ? "text-amber-600 dark:text-amber-400"
    : "text-red-600 dark:text-red-400";

  const margenBrutoColor = margenBruto === null ? "text-muted-foreground"
    : margenBruto > 0.30 ? "text-green-600 dark:text-green-400"
    : margenBruto >= 0.15 ? "text-amber-600 dark:text-amber-400"
    : "text-red-600 dark:text-red-400";

  const equilibrioSuperado = puntoEquilibrio !== null && totalSalesInPeriod >= puntoEquilibrio;
  const equilibrioFalta = puntoEquilibrio !== null && !equilibrioSuperado
    ? puntoEquilibrio - totalSalesInPeriod : 0;

  const liquidezOk = disponible >= pendingFixedTotal;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {/* 1. Dinero Disponible */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-1 p-3 md:p-4 md:pb-1">
          <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Dinero Disponible</CardTitle>
          <Wallet className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="p-3 pt-0 md:p-4 md:pt-0">
          <div className={`text-lg md:text-2xl font-bold ${disponible >= 0 ? "text-foreground" : "text-destructive"}`}>
            {fmt(disponible)}
          </div>
          {margenNeto !== null ? (
            <span className={`text-xs font-semibold ${margenNetoColor}`}>
              Margen neto: {(margenNeto * 100).toFixed(1)}%
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </CardContent>
      </Card>

      {/* 2. Margen Bruto */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-1 p-3 md:p-4 md:pb-1">
          <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Margen Bruto</CardTitle>
          <TrendingUp className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="p-3 pt-0 md:p-4 md:pt-0">
          <div className={`text-lg md:text-2xl font-bold ${margenBrutoColor}`}>
            {margenBruto !== null ? `${(margenBruto * 100).toFixed(1)}%` : "—"}
          </div>
          <span className="text-xs text-muted-foreground">
            COGS: {fmt(cogs)}
          </span>
        </CardContent>
      </Card>

      {/* 3. Punto de Equilibrio */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-1 p-3 md:p-4 md:pb-1">
          <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Punto Equilibrio</CardTitle>
          <Target className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="p-3 pt-0 md:p-4 md:pt-0">
          <div className="text-lg md:text-2xl font-bold">
            {puntoEquilibrio !== null ? fmt(puntoEquilibrio) : "—"}
          </div>
          {puntoEquilibrio !== null ? (
            equilibrioSuperado ? (
              <Badge variant="outline" className="text-[10px] border-green-500/40 text-green-600 dark:text-green-400 gap-0.5">
                ✓ Superado
              </Badge>
            ) : (
              <span className="text-xs text-red-600 dark:text-red-400">
                Falta {fmt(equilibrioFalta)}
              </span>
            )
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </CardContent>
      </Card>

      {/* 4. Liquidez */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-1 p-3 md:p-4 md:pb-1">
          <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Liquidez</CardTitle>
          <ShieldCheck className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="p-3 pt-0 md:p-4 md:pt-0">
          {pendingFixedTotal === 0 && disponible === 0 ? (
            <>
              <div className="text-lg md:text-2xl font-bold text-muted-foreground">—</div>
              <span className="text-xs text-muted-foreground">Sin datos</span>
            </>
          ) : liquidezOk ? (
            <>
              <div className="text-lg md:text-2xl font-bold text-green-600 dark:text-green-400">Al día</div>
              <span className="text-xs text-muted-foreground">
                Cubre gastos pendientes
              </span>
            </>
          ) : (
            <>
              <div className="text-lg md:text-2xl font-bold text-red-600 dark:text-red-400">Atención</div>
              <span className="text-xs text-red-600 dark:text-red-400">
                Déficit: {fmt(pendingFixedTotal - disponible)}
              </span>
            </>
          )}
        </CardContent>
      </Card>

      {/* 5. Gastos del Mes */}
      <Card className={`col-span-2 lg:col-span-1 ${gastosVencido > 0 ? "border-red-400/50 dark:border-red-600/40" : ""}`}>
        <CardHeader className="flex flex-row items-center justify-between pb-1 p-3 md:p-4 md:pb-1">
          <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Gastos del Mes</CardTitle>
          <FileText className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="p-3 pt-0 md:p-4 md:pt-0 space-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-green-600 dark:text-green-400">Pagado</span>
            <span className="text-xs font-semibold">{fmt(gastosPagado)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Pendiente</span>
            <span className="text-xs font-semibold">{fmt(gastosPendiente)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-red-600 dark:text-red-400">Vencido</span>
            <span className="text-xs font-semibold">{fmt(gastosVencido)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
