import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, ShoppingCart, Wrench, ArrowDownToLine, Package, Users, ArrowUpFromLine, ReceiptText, FileText, Printer } from "lucide-react";

type Period = "today" | "week" | "month" | "all";
type TreasuryMode = "operativo" | "real";

interface Props {
  businessId: string;
  branchId?: string | null;
  period: Period;
  mode: TreasuryMode;
}

function getDateRange(period: Period): { from: string | null; to: string } {
  const now = new Date();
  const to = now.toISOString();
  if (period === "all") return { from: null, to };
  const d = new Date(now);
  if (period === "today") d.setHours(0, 0, 0, 0);
  else if (period === "week") d.setDate(d.getDate() - 7);
  else if (period === "month") d.setDate(d.getDate() - 30);
  return { from: d.toISOString(), to };
}

function getPreviousDateRange(period: Period): { from: string; to: string } | null {
  if (period === "all") return null;
  const now = new Date();
  if (period === "today") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const end = new Date(yesterday);
    end.setHours(23, 59, 59, 999);
    return { from: yesterday.toISOString(), to: end.toISOString() };
  }
  if (period === "week") {
    const end = new Date(now);
    end.setDate(end.getDate() - 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  if (period === "month") {
    const end = new Date(now);
    end.setDate(end.getDate() - 30);
    const start = new Date(end);
    start.setDate(start.getDate() - 30);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  return null;
}

const PERIOD_DAYS: Record<Period, number> = {
  today: 1,
  week: 7,
  month: 30,
  all: 365,
};

const FREQUENCY_DIVISOR: Record<string, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 15,
  monthly: 30,
  quarterly: 90,
  annual: 365,
};

function calcAccruedFixedExpenses(
  expenses: { amount: number; frequency: string | null }[],
  period: Period
): number {
  const days = PERIOD_DAYS[period];
  return expenses.reduce((sum, e) => {
    const divisor = FREQUENCY_DIVISOR[e.frequency || "monthly"] || 30;
    const dailyCost = e.amount / divisor;
    return sum + dailyCost * days;
  }, 0);
}

export default function BalancePersonalCards({ businessId, branchId, period, mode }: Props) {
  const { from, to } = useMemo(() => getDateRange(period), [period]);
  const prevRange = useMemo(() => getPreviousDateRange(period), [period]);

  // Check if copy_shop
  const { data: isCopyShop = false } = useQuery({
    queryKey: ["bp-is-copy-shop", businessId],
    queryFn: async () => {
      const { data } = await supabase.from("businesses").select("business_type").eq("id", businessId).maybeSingle();
      return data?.business_type === 'copy_shop';
    },
    enabled: !!businessId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: businessBranchIds = [] } = useQuery({
    queryKey: ["bp-branch-ids", businessId],
    queryFn: async () => {
      const { data } = await supabase
        .from("branches")
        .select("id")
        .eq("business_id", businessId);
      return (data || []).map((b) => b.id);
    },
    enabled: !!businessId,
    staleTime: 5 * 60 * 1000,
  });

  const saleBranchIds = branchId ? [branchId] : businessBranchIds;


  // --- Helper to fetch a sum with date range ---
  const fetchSalesSum = async (branchIds: string[], dateFrom: string | null, dateTo: string) => {
    if (branchIds.length === 0) return 0;
    let q = supabase.from("sales").select("total").eq("status", "completed").in("branch_id", branchIds);
    if (dateFrom) q = q.gte("created_at", dateFrom);
    q = q.lte("created_at", dateTo);
    const { data } = await q;
    return data?.reduce((sum, s) => sum + Number(s.total), 0) || 0;
  };

  const fetchServiceSum = async (dateFrom: string | null, dateTo: string) => {
    let q = supabase.from("service_entries").select("amount").eq("business_id", businessId);
    if (branchId) q = q.eq("branch_id", branchId);
    if (dateFrom) q = q.gte("created_at", dateFrom);
    q = q.lte("created_at", dateTo);
    const { data } = await q;
    return data?.reduce((sum, s) => sum + Number(s.amount), 0) || 0;
  };

  const fetchInjectionSum = async (dateFrom: string | null, dateTo: string) => {
    let q = supabase.from("treasury_movements" as any).select("amount").eq("business_id", businessId).eq("movement_type", "inyeccion");
    if (branchId) q = q.eq("branch_id", branchId);
    if (dateFrom) q = q.gte("created_at", dateFrom);
    q = q.lte("created_at", dateTo);
    const { data } = await q;
    return (data as any[])?.reduce((sum: number, m: any) => sum + Number(m.amount), 0) || 0;
  };

  const fetchExtractionSum = async (dateFrom: string | null, dateTo: string) => {
    let q = supabase.from("treasury_movements" as any).select("amount, category_id").eq("business_id", businessId).eq("movement_type", "extraccion");
    if (branchId) q = q.eq("branch_id", branchId);
    if (dateFrom) q = q.gte("created_at", dateFrom);
    q = q.lte("created_at", dateTo);
    const { data } = await q;
    let total = 0;
    (data as any[])?.forEach((m: any) => { total += Number(m.amount); });
    return total;
  };

  const fetchSalarySum = async (dateFrom: string | null, dateTo: string) => {
    let q = supabase.from("employee_salary_records" as any).select("amount").eq("business_id", businessId);
    if (branchId) q = q.eq("branch_id", branchId);
    if (dateFrom) q = q.gte("created_at", dateFrom);
    q = q.lte("created_at", dateTo);
    const { data } = await q;
    return (data as any[])?.reduce((sum: number, r: any) => sum + Number(r.amount), 0) || 0;
  };

  const fetchFixedExpensesSum = async (dateFrom: string | null, dateTo: string) => {
    let q = supabase.from("accounting_expenses").select("amount").eq("business_id", businessId).eq("expense_type", "fixed").eq("status", "paid");
    if (dateFrom) q = q.gte("paid_at", dateFrom);
    q = q.lte("paid_at", dateTo);
    const { data } = await q;
    return (data || []).reduce((sum, e) => sum + Number(e.amount), 0);
  };

  // Product sales
  const { data: productSales = 0 } = useQuery({
    queryKey: ["bp-product-sales", businessId, branchId, period, saleBranchIds],
    queryFn: () => fetchSalesSum(saleBranchIds, from, to),
    enabled: !!businessId && saleBranchIds.length > 0,
  });

  // Service sales
  const { data: serviceSales = 0 } = useQuery({
    queryKey: ["bp-service-sales", businessId, branchId, period],
    queryFn: () => fetchServiceSum(from, to),
    enabled: !!businessId,
  });

  // Print jobs (copy_shop only)
  const { data: printJobSales = 0 } = useQuery({
    queryKey: ["bp-print-jobs", businessId, branchId, period, saleBranchIds],
    queryFn: async () => {
      let q = supabase.from("print_jobs").select("total").eq("business_id", businessId);
      if (branchId) q = q.eq("branch_id", branchId);
      else if (saleBranchIds.length) q = q.in("branch_id", saleBranchIds);
      if (from) q = q.gte("created_at", from);
      q = q.lte("created_at", to);
      const { data } = await q;
      return data?.reduce((sum, r) => sum + Number(r.total || 0), 0) || 0;
    },
    enabled: !!businessId && isCopyShop,
  });

  // Injections
  const { data: injections = 0 } = useQuery({
    queryKey: ["bp-injections", businessId, branchId, period],
    queryFn: () => fetchInjectionSum(from, to),
    enabled: !!businessId,
  });

  // COGS (Operativo)
  const { data: productCost = 0 } = useQuery({
    queryKey: ["bp-product-cost", businessId, branchId, period, saleBranchIds],
    queryFn: async () => {
      if (saleBranchIds.length === 0) return 0;
      let sq = supabase.from("sales").select("id").eq("status", "completed").in("branch_id", saleBranchIds);
      if (from) sq = sq.gte("created_at", from);
      sq = sq.lte("created_at", to);
      const { data: sales } = await sq;
      if (!sales || sales.length === 0) return 0;
      const saleIds = sales.map((s: any) => s.id);
      let total = 0;
      for (let i = 0; i < saleIds.length; i += 50) {
        const chunk = saleIds.slice(i, i + 50);
        const { data: items } = await supabase.from("sale_items").select("quantity, cost_price").in("sale_id", chunk);
        total += (items || []).reduce((sum: number, it: any) => sum + Number(it.quantity) * Number(it.cost_price || 0), 0);
      }
      return total;
    },
    enabled: !!businessId && mode === "operativo" && saleBranchIds.length > 0,
  });

  // Inventory purchases (Real)
  const { data: inventoryPurchases = 0 } = useQuery({
    queryKey: ["bp-inventory-purchases", businessId, branchId, period],
    queryFn: async () => {
      let q = supabase.from("product_stock_entries").select("unit_cost, quantity").eq("business_id", businessId);
      if (branchId) q = q.eq("branch_id", branchId);
      if (from) q = q.gte("created_at", from);
      q = q.lte("created_at", to);
      const { data } = await q;
      return (data || []).reduce((sum: number, e: any) => sum + Number(e.unit_cost || 0) * Number(e.quantity || 0), 0);
    },
    enabled: !!businessId && mode === "real",
  });

  // Salaries paid
  const { data: salariesPaid = 0 } = useQuery({
    queryKey: ["bp-salaries", businessId, branchId, period],
    queryFn: () => fetchSalarySum(from, to),
    enabled: !!businessId,
  });

  // Extractions
  const { data: extractionData } = useQuery({
    queryKey: ["bp-extractions", businessId, branchId, period],
    queryFn: async () => {
      let q = supabase.from("treasury_movements" as any).select("amount, category_id").eq("business_id", businessId).eq("movement_type", "extraccion");
      if (branchId) q = q.eq("branch_id", branchId);
      if (from) q = q.gte("created_at", from);
      q = q.lte("created_at", to);
      const { data } = await q;
      let retiro = 0;
      let otros = 0;
      (data as any[])?.forEach((m: any) => {
        if (m.label === "personal") retiro += Number(m.amount);
        else otros += Number(m.amount);
      });
      return { retiro, otros, total: retiro + otros };
    },
    enabled: !!businessId,
  });

  // Fixed expenses paid (Real mode value)
  const { data: fixedExpensesPaid = 0 } = useQuery({
    queryKey: ["bp-fixed-expenses", businessId, period],
    queryFn: () => fetchFixedExpensesSum(from, to),
    enabled: !!businessId,
  });

  // Fixed expenses for accrual calculation (Operativo mode)
  const { data: fixedExpensesForAccrual = [] } = useQuery({
    queryKey: ["bp-fixed-expenses-accrual", businessId],
    queryFn: async () => {
      const { data } = await supabase
        .from("accounting_expenses")
        .select("amount, frequency")
        .eq("business_id", businessId)
        .eq("expense_type", "fixed")
        .in("status", ["paid", "pending", "overdue"]);
      // Deduplicate by name+frequency (recurring generates next occurrence, we only want unique obligations)
      // Since we query all statuses, group by amount+frequency to avoid double-counting recurring expenses
      return (data || []).map((e) => ({
        amount: Number(e.amount),
        frequency: e.frequency,
      }));
    },
    enabled: !!businessId && mode === "operativo",
  });

  // Deduplicate recurring fixed expenses: keep only the latest per unique amount+frequency combo
  const uniqueFixedObligations = useMemo(() => {
    if (mode !== "operativo") return [];
    const seen = new Map<string, { amount: number; frequency: string | null }>();
    for (const e of fixedExpensesForAccrual) {
      const key = `${e.amount}-${e.frequency}`;
      seen.set(key, e);
    }
    return Array.from(seen.values());
  }, [fixedExpensesForAccrual, mode]);

  const accruedFixedExpenses = useMemo(() => {
    if (mode !== "operativo") return 0;
    return calcAccruedFixedExpenses(uniqueFixedObligations, period);
  }, [uniqueFixedObligations, period, mode]);

  // Previous period totals for comparison
  const { data: prevTotals } = useQuery({
    queryKey: ["bp-prev-totals", businessId, branchId, period, saleBranchIds],
    queryFn: async () => {
      if (!prevRange) return null;
      const [pSales, pServices, pInjections, pExtractions, pSalaries, pFixed] = await Promise.all([
        fetchSalesSum(saleBranchIds, prevRange.from, prevRange.to),
        fetchServiceSum(prevRange.from, prevRange.to),
        fetchInjectionSum(prevRange.from, prevRange.to),
        fetchExtractionSum(prevRange.from, prevRange.to),
        fetchSalarySum(prevRange.from, prevRange.to),
        fetchFixedExpensesSum(prevRange.from, prevRange.to),
      ]);
      return {
        ingresos: pSales + pServices + pInjections,
        gastos: pExtractions + pSalaries + pFixed,
      };
    },
    enabled: !!businessId && !!prevRange && saleBranchIds.length > 0,
  });

  const extractions = extractionData || { retiro: 0, otros: 0, total: 0 };
  const totalIngresos = productSales + serviceSales + injections + printJobSales;

  // Use accrued value in Operativo, real paid in Real
  const effectiveFixedExpenses = mode === "operativo" ? accruedFixedExpenses : fixedExpensesPaid;

  const compromisos = salariesPaid + extractions.total + effectiveFixedExpenses;
  const disponible = mode === "real"
    ? totalIngresos - compromisos - inventoryPurchases
    : totalIngresos - compromisos;

  const totalGastosDisplay = mode === "real"
    ? inventoryPurchases + salariesPaid + extractions.total + effectiveFixedExpenses
    : productCost + salariesPaid + extractions.total + effectiveFixedExpenses;

  const fmt = (n: number) => "$" + n.toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Comparison helpers
  const renderComparison = (current: number, previous: number | undefined) => {
    if (previous === undefined || previous === null || period === "all") return null;
    if (previous === 0) return null;
    const pct = Math.round(((current - previous) / previous) * 100);
    const isUp = pct >= 0;
    return (
      <p className={`text-xs mt-0.5 ${isUp ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
        {isUp ? "↑" : "↓"} {Math.abs(pct)}% vs período anterior
      </p>
    );
  };

  // Margin
  const margenNeto = totalIngresos > 0
    ? Math.round(((totalIngresos - totalGastosDisplay) / totalIngresos) * 100)
    : null;

  return (
    <div className="space-y-3">
      {/* INGRESOS */}
      <Card className="border-green-200 dark:border-green-800/40">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="rounded-full p-1.5 bg-green-100 dark:bg-green-900/30">
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-green-700 dark:text-green-400">
              Mis Ingresos
            </h3>
          </div>
          <div className={`grid grid-cols-2 ${isCopyShop ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-2`}>
            <MiniCard icon={<ShoppingCart className="h-3.5 w-3.5" />} label="Ventas de Productos" value={fmt(productSales)} />
            <MiniCard icon={<Wrench className="h-3.5 w-3.5" />} label="Ventas de Servicios" value={fmt(serviceSales)} />
            {isCopyShop && <MiniCard icon={<Printer className="h-3.5 w-3.5" />} label="Ingresos Impresiones" value={fmt(printJobSales)} />}
            <MiniCard icon={<ArrowDownToLine className="h-3.5 w-3.5" />} label="Inyecciones" value={fmt(injections)} />
          </div>
          <div className="border-t pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Total Ingresos</span>
              <span className="text-base font-bold text-green-600">{fmt(totalIngresos)}</span>
            </div>
            {renderComparison(totalIngresos, prevTotals?.ingresos)}
          </div>
        </CardContent>
      </Card>

      {/* GASTOS */}
      <Card className="border-red-200 dark:border-red-800/40">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="rounded-full p-1.5 bg-red-100 dark:bg-red-900/30">
              <TrendingDown className="h-4 w-4 text-red-600" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-red-700 dark:text-red-400">
              Mis Gastos
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {mode === "operativo" ? (
              <MiniCard icon={<Package className="h-3.5 w-3.5" />} label="Costo productos vendidos" value={fmt(productCost)} muted />
            ) : (
              <MiniCard icon={<Package className="h-3.5 w-3.5" />} label="Compras de inventario" value={fmt(inventoryPurchases)} />
            )}
            <MiniCard icon={<Users className="h-3.5 w-3.5" />} label="Salarios pagados" value={fmt(salariesPaid)} />
            <MiniCard icon={<ArrowUpFromLine className="h-3.5 w-3.5" />} label="Dinero que sacaste" value={fmt(extractions?.retiro || 0)} />
            <MiniCard icon={<ReceiptText className="h-3.5 w-3.5" />} label="Otros gastos" value={fmt(extractions?.otros || 0)} />
            <MiniCard
              icon={<FileText className="h-3.5 w-3.5" />}
              label="Gastos fijos pagados"
              value={fmt(effectiveFixedExpenses)}
              subtitle={mode === "operativo" ? "Devengado" : undefined}
            />
          </div>
          <div className="border-t pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Total Gastos</span>
              <span className="text-base font-bold text-red-600">{fmt(totalGastosDisplay)}</span>
            </div>
            {renderComparison(totalGastosDisplay, prevTotals?.gastos)}
          </div>
        </CardContent>
      </Card>

      {/* DISPONIBLE */}
      <Card className={`border-2 ${disponible >= 0 ? "border-green-400 dark:border-green-600 bg-green-50/50 dark:bg-green-950/20" : "border-red-400 dark:border-red-600 bg-red-50/50 dark:bg-red-950/20"}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`rounded-full p-1.5 ${disponible >= 0 ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
              <Wallet className={`h-4 w-4 ${disponible >= 0 ? "text-green-600" : "text-red-600"}`} />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wide">
              Tu Dinero Disponible
            </h3>
          </div>
          <div className="text-center py-2">
            <p className={`text-2xl md:text-3xl font-extrabold ${disponible >= 0 ? "text-green-600" : "text-red-600"}`}>
              {fmt(disponible)}
            </p>
            {margenNeto !== null && (
              <p className={`text-xs font-semibold mt-1 ${margenNeto >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                Margen neto del período: {margenNeto}%
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {mode === "operativo"
                ? `${fmt(totalIngresos)} ingresos − ${fmt(compromisos)} compromisos`
                : `${fmt(totalIngresos)} ingresos − ${fmt(compromisos + inventoryPurchases)} gastos reales`}
            </p>
            {disponible >= 0 && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-medium">
                ✓ Puedes sacarlo sin afectar el negocio
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MiniCard({ icon, label, value, muted, subtitle }: { icon: React.ReactNode; label: string; value: string; muted?: boolean; subtitle?: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2.5 space-y-0.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
      </div>
      <p className={`text-sm font-bold ${muted ? "text-muted-foreground" : "text-foreground"}`}>{value}</p>
      {subtitle && (
        <p className="text-[9px] text-muted-foreground italic">{subtitle}</p>
      )}
      <p className="text-[10px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}
