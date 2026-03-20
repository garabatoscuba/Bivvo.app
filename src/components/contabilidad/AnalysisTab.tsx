import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  format, startOfDay, endOfDay, startOfWeek, startOfMonth, startOfYear,
  endOfMonth, endOfYear, addDays, addWeeks, addMonths, isBefore, subDays,
  subMonths, subYears,
} from "date-fns";
import { es } from "date-fns/locale";
import { TrendingUp, TrendingDown, Target, RotateCcw } from "lucide-react";

type Period = "today" | "week" | "month" | "year";

interface Props {
  businessId: string;
  branchId?: string | null;
}

// ─── Date helpers ───
function getRange(p: Period): { from: Date; to: Date } {
  const now = new Date();
  switch (p) {
    case "today": return { from: startOfDay(now), to: endOfDay(now) };
    case "week": return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case "month": return { from: startOfMonth(now), to: endOfMonth(now) };
    case "year": return { from: startOfYear(now), to: endOfYear(now) };
  }
}

function getPrevRange(p: Period): { from: Date; to: Date } {
  const now = new Date();
  switch (p) {
    case "today": { const y = subDays(now, 1); return { from: startOfDay(y), to: endOfDay(y) }; }
    case "week": return { from: startOfDay(subDays(now, 13)), to: endOfDay(subDays(now, 7)) };
    case "month": { const m = subMonths(now, 1); return { from: startOfMonth(m), to: endOfMonth(m) }; }
    case "year": { const y = subYears(now, 1); return { from: startOfYear(y), to: endOfYear(y) }; }
  }
}

function generateBuckets(p: Period, from: Date, to: Date) {
  const buckets: { key: string; label: string; start: Date; end: Date }[] = [];
  if (p === "today" || p === "week") {
    let cur = startOfDay(from);
    while (isBefore(cur, to) || cur.getTime() === startOfDay(to).getTime()) {
      buckets.push({ key: format(cur, "yyyy-MM-dd"), label: format(cur, "dd MMM", { locale: es }), start: startOfDay(cur), end: endOfDay(cur) });
      cur = addDays(cur, 1);
    }
  } else if (p === "month") {
    let cur = startOfWeek(from, { weekStartsOn: 1 });
    while (isBefore(cur, to)) {
      const we = addDays(cur, 6);
      buckets.push({ key: format(cur, "yyyy-'W'ww"), label: `${format(cur, "dd")}-${format(we, "dd MMM", { locale: es })}`, start: cur, end: endOfDay(we) });
      cur = addWeeks(cur, 1);
    }
  } else {
    let cur = startOfMonth(from);
    while (isBefore(cur, to)) {
      const me = addMonths(cur, 1);
      buckets.push({ key: format(cur, "yyyy-MM"), label: format(cur, "MMM", { locale: es }), start: cur, end: endOfDay(addDays(me, -1)) });
      cur = me;
    }
  }
  return buckets;
}

const fmt = (n: number) => "$" + n.toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => (n * 100).toFixed(1) + "%";

export default function AnalysisTab({ businessId, branchId }: Props) {
  const [period, setPeriod] = useState<Period>("month");
  const range = useMemo(() => getRange(period), [period]);
  const prev = useMemo(() => getPrevRange(period), [period]);
  const fromStr = range.from.toISOString();
  const toStr = range.to.toISOString();
  const prevFromStr = prev.from.toISOString();
  const prevToStr = prev.to.toISOString();

  // Branch IDs
  const { data: allBranchIds = [] } = useQuery({
    queryKey: ["analysis-branches", businessId],
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("id").eq("business_id", businessId);
      return (data || []).map(b => b.id);
    },
    enabled: !!businessId,
    staleTime: 5 * 60 * 1000,
  });
  const branchIds = branchId ? [branchId] : allBranchIds;

  // ─── Fetchers ───
  const fetchSales = async (f: string, t: string) => {
    if (!branchIds.length) return [];
    let q = supabase.from("sales").select("id, total, created_at").eq("status", "completed").in("branch_id", branchIds).gte("created_at", f).lte("created_at", t);
    const { data } = await q;
    return data || [];
  };

  const fetchCOGS = async (saleIds: string[]) => {
    if (!saleIds.length) return 0;
    let total = 0;
    for (let i = 0; i < saleIds.length; i += 50) {
      const chunk = saleIds.slice(i, i + 50);
      const { data } = await supabase.from("sale_items").select("quantity, cost_price").in("sale_id", chunk);
      total += (data || []).reduce((s, it: any) => s + Number(it.quantity) * Number(it.cost_price || 0), 0);
    }
    return total;
  };

  const fetchServices = async (f: string, t: string) => {
    let q = supabase.from("service_entries").select("amount, created_at").eq("business_id", businessId).gte("created_at", f).lte("created_at", t);
    if (branchId) q = q.eq("branch_id", branchId);
    const { data } = await q;
    return data || [];
  };

  const fetchExtractions = async (f: string, t: string) => {
    let q = supabase.from("treasury_movements" as any).select("amount, created_at").eq("business_id", businessId).eq("movement_type", "extraccion").gte("created_at", f).lte("created_at", t);
    if (branchId) q = q.eq("branch_id", branchId);
    const { data } = await q;
    return (data as any[]) || [];
  };

  const fetchInjections = async (f: string, t: string) => {
    let q = supabase.from("treasury_movements" as any).select("amount, created_at").eq("business_id", businessId).eq("movement_type", "inyeccion").gte("created_at", f).lte("created_at", t);
    if (branchId) q = q.eq("branch_id", branchId);
    const { data } = await q;
    return (data as any[]) || [];
  };

  const fetchSalaries = async (f: string, t: string) => {
    let q = supabase.from("employee_salary_records" as any).select("amount, created_at").eq("business_id", businessId).gte("created_at", f).lte("created_at", t);
    if (branchId) q = q.eq("branch_id", branchId);
    const { data } = await q;
    return (data as any[]) || [];
  };

  const fetchFixedExpenses = async (f: string, t: string) => {
    let q = supabase.from("accounting_expenses").select("amount, paid_at").eq("business_id", businessId).eq("status", "paid").gte("paid_at", f).lte("paid_at", t);
    const { data } = await q;
    return data || [];
  };


  // ─── Current period data ───
  const { data: currentData, isLoading } = useQuery({
    queryKey: ["analysis-current", businessId, branchId, period, branchIds],
    queryFn: async () => {
      const [sales, services, extractions, injections, salaries, fixedExp] = await Promise.all([
        fetchSales(fromStr, toStr),
        fetchServices(fromStr, toStr),
        fetchExtractions(fromStr, toStr),
        fetchInjections(fromStr, toStr),
        fetchSalaries(fromStr, toStr),
        fetchFixedExpenses(fromStr, toStr),
      ]);

      const saleIds = sales.map((s: any) => s.id);
      const cogs = await fetchCOGS(saleIds);

      const totalSales = sales.reduce((s, r: any) => s + Number(r.total), 0);
      const totalServices = services.reduce((s, r: any) => s + Number(r.amount), 0);
      const totalInjections = injections.reduce((s: number, r: any) => s + Number(r.amount), 0);
      const totalExtractions = extractions.reduce((s: number, r: any) => s + Number(r.amount), 0);
      const totalSalaries = salaries.reduce((s: number, r: any) => s + Number(r.amount), 0);
      const totalFixed = fixedExp.reduce((s, r: any) => s + Number(r.amount), 0);

      const ingresos = totalSales + totalServices + totalInjections;
      const totalGastos = cogs + totalSalaries + totalExtractions + totalFixed;

      return {
        sales, services, extractions, salaries, fixedExp, injections,
        totalSales, totalServices, totalInjections,
        totalExtractions, totalSalaries, totalFixed,
        cogs, ingresos, totalGastos,
      };
    },
    enabled: !!businessId && branchIds.length > 0,
  });

  // ─── Previous period data ───
  const { data: prevData } = useQuery({
    queryKey: ["analysis-prev", businessId, branchId, period, branchIds],
    queryFn: async () => {
      const [sales, services, extractions, injections, salaries, fixedExp] = await Promise.all([
        fetchSales(prevFromStr, prevToStr),
        fetchServices(prevFromStr, prevToStr),
        fetchExtractions(prevFromStr, prevToStr),
        fetchInjections(prevFromStr, prevToStr),
        fetchSalaries(prevFromStr, prevToStr),
        fetchFixedExpenses(prevFromStr, prevToStr),
      ]);

      const saleIds = sales.map((s: any) => s.id);
      const cogs = await fetchCOGS(saleIds);

      const totalSales = sales.reduce((s, r: any) => s + Number(r.total), 0);
      const totalServices = services.reduce((s, r: any) => s + Number(r.amount), 0);
      const totalInjections = injections.reduce((s: number, r: any) => s + Number(r.amount), 0);
      const totalExtractions = extractions.reduce((s: number, r: any) => s + Number(r.amount), 0);
      const totalSalaries = salaries.reduce((s: number, r: any) => s + Number(r.amount), 0);
      const totalFixed = fixedExp.reduce((s, r: any) => s + Number(r.amount), 0);

      const ingresos = totalSales + totalServices + totalInjections;
      const totalGastos = cogs + totalSalaries + totalExtractions + totalFixed;

      return { cogs, totalSalaries, totalExtractions, totalFixed, ingresos, totalGastos };
    },
    enabled: !!businessId && branchIds.length > 0,
  });


  // ─── Inventory rotation ───
  const { data: inventoryRotation } = useQuery({
    queryKey: ["analysis-inv-rotation", businessId, branchId, period],
    queryFn: async () => {
      // Average inventory value from branch_stock
      let q = supabase.from("branch_stock").select("quantity, product_id").eq("quantity", 0).gte("quantity", 0);
      if (branchId) q = q.eq("branch_id", branchId);
      // Get all stock with products
      let sq = supabase.from("branch_stock").select("quantity, product_id");
      if (branchId) sq = sq.eq("branch_id", branchId);
      else if (branchIds.length) sq = sq.in("branch_id", branchIds);
      const { data: stockRows } = await sq;
      if (!stockRows?.length) return null;

      const pIds = [...new Set(stockRows.map(r => r.product_id))];
      const { data: products } = await supabase.from("products").select("id, cost_price").in("id", pIds);
      const costMap = new Map((products || []).map(p => [p.id, Number(p.cost_price || 0)]));

      const avgValue = stockRows.reduce((s, r) => s + Number(r.quantity) * (costMap.get(r.product_id) || 0), 0);
      if (avgValue <= 0) return null;

      const salesTotal = currentData?.totalSales || 0;
      return salesTotal / avgValue;
    },
    enabled: !!businessId && !!currentData && branchIds.length > 0,
  });

  // ─── Chart data ───
  const chartData = useMemo(() => {
    if (!currentData) return [];
    const buckets = generateBuckets(period, range.from, range.to);
    const assign = (dateStr: string) => {
      const ts = new Date(dateStr).getTime();
      for (const b of buckets) if (ts >= b.start.getTime() && ts <= b.end.getTime()) return b.key;
      return null;
    };
    const result: Record<string, { label: string; ingresos: number; gastos: number }> = {};
    buckets.forEach(b => { result[b.key] = { label: b.label, ingresos: 0, gastos: 0 }; });

    currentData.sales.forEach((s: any) => { const k = assign(s.created_at); if (k) result[k].ingresos += Number(s.total); });
    currentData.services.forEach((s: any) => { const k = assign(s.created_at); if (k) result[k].ingresos += Number(s.amount); });
    currentData.injections.forEach((s: any) => { const k = assign(s.created_at); if (k) result[k].ingresos += Number(s.amount); });
    currentData.extractions.forEach((s: any) => { const k = assign(s.created_at); if (k) result[k].gastos += Number(s.amount); });
    currentData.salaries.forEach((s: any) => { const k = assign(s.created_at); if (k) result[k].gastos += Number(s.amount); });
    currentData.fixedExp.forEach((s: any) => { if (!s.paid_at) return; const k = assign(s.paid_at); if (k) result[k].gastos += Number(s.amount); });

    return buckets.map(b => ({ name: result[b.key].label, Ingresos: Math.round(result[b.key].ingresos * 100) / 100, Gastos: Math.round(result[b.key].gastos * 100) / 100 }));
  }, [currentData, period, range]);

  // ─── Computed indices ───
  const d = currentData;
  const ingresos = d?.ingresos || 0;
  const cogs = d?.cogs || 0;
  const margenBruto = ingresos > 0 ? (ingresos - cogs) / ingresos : 0;
  const margenNeto = ingresos > 0 ? (ingresos - (d?.totalGastos || 0)) / ingresos : 0;
  const puntoEquilibrio = margenBruto > 0 ? (d?.totalFixed || 0) / margenBruto : null;

  // ─── Available (from Balance logic) ───
  const disponible = ingresos - (d?.totalGastos || 0);

  const colorFor = (val: number, good: number, mid: number) =>
    val >= good ? "text-green-600 dark:text-green-400" : val >= mid ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";

  const compArrow = (cur: number, prev: number | undefined) => {
    if (!prev || prev === 0) return null;
    const p = Math.round(((cur - prev) / prev) * 100);
    const up = p >= 0;
    return <span className={`text-xs ${up ? "text-green-600" : "text-red-500"}`}>{up ? "↑" : "↓"}{Math.abs(p)}%</span>;
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Cargando análisis…</div>;
  }

  const compRows = [
    { label: "Ingresos totales", cur: ingresos, prev: prevData?.ingresos },
    { label: "COGS", cur: cogs, prev: prevData?.cogs },
    { label: "Salarios", cur: d?.totalSalaries || 0, prev: prevData?.totalSalaries },
    { label: "Gastos fijos", cur: d?.totalFixed || 0, prev: prevData?.totalFixed },
    { label: "Otros gastos", cur: d?.totalExtractions || 0, prev: prevData?.totalExtractions },
    { label: "Total gastos", cur: d?.totalGastos || 0, prev: prevData?.totalGastos },
    { label: "Margen bruto %", cur: margenBruto, prev: prevData && prevData.ingresos > 0 ? (prevData.ingresos - prevData.cogs) / prevData.ingresos : undefined, isPct: true },
    { label: "Margen neto %", cur: margenNeto, prev: prevData && prevData.ingresos > 0 ? (prevData.ingresos - prevData.totalGastos) / prevData.ingresos : undefined, isPct: true },
  ];

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex gap-1.5 overflow-x-auto">
        {([
          { key: "today" as Period, label: "Hoy" },
          { key: "week" as Period, label: "Esta Semana" },
          { key: "month" as Period, label: "Este Mes" },
          { key: "year" as Period, label: "Este Año" },
        ]).map(p => (
          <Button
            key={p.key}
            size="sm"
            variant={period === p.key ? "default" : "outline"}
            className="text-xs h-8 shrink-0"
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* Block 1: Chart */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Ingresos vs Gastos</h3>
          {chartData.length > 0 ? (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <RTooltip formatter={(v: number) => ["$" + v.toLocaleString("es", { minimumFractionDigits: 2 })]} contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', padding: '8px', fontSize: 12 }} labelStyle={{ color: '#fff' }} itemStyle={{ color: '#fff' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Ingresos" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Gastos" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Sin datos en este período</p>
          )}
        </CardContent>
      </Card>

      {/* Block 2: Key indices */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <IndexCard
          icon={<TrendingUp className="h-4 w-4" />}
          title="Margen Bruto"
          value={ingresos > 0 ? pct(margenBruto) : "Sin datos"}
          color={ingresos > 0 ? colorFor(margenBruto, 0.30, 0.15) : "text-muted-foreground"}
          desc="(Ingresos − Costo productos) / Ingresos. Mide cuánto ganas por cada venta antes de otros gastos."
        />
        <IndexCard
          icon={<TrendingDown className="h-4 w-4" />}
          title="Margen Neto"
          value={ingresos > 0 ? pct(margenNeto) : "Sin datos"}
          color={ingresos > 0 ? colorFor(margenNeto, 0.10, 0.05) : "text-muted-foreground"}
          desc="(Ingresos − Todos los gastos) / Ingresos. Lo que realmente queda después de pagar todo."
        />
        <IndexCard
          icon={<Target className="h-4 w-4" />}
          title="Punto de Equilibrio"
          value={puntoEquilibrio !== null ? fmt(puntoEquilibrio) : "Sin datos"}
          color="text-foreground"
          desc="Ventas mínimas necesarias para cubrir gastos fijos. Debajo de esto, pierdes dinero."
        />
        <IndexCard
          icon={<RotateCcw className="h-4 w-4" />}
          title="Rotación de Inventario"
          value={inventoryRotation !== null && inventoryRotation !== undefined ? inventoryRotation.toFixed(2) + "x" : "No aplica"}
          color="text-foreground"
          desc="Cuántas veces rotó tu inventario en el período. Mayor es mejor."
        />
      </div>

      {/* Block 3: Comparison table */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Comparativa de períodos</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Concepto</TableHead>
                  <TableHead className="text-xs text-right">Período Actual</TableHead>
                  <TableHead className="text-xs text-right">Período Anterior</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {compRows.map(r => (
                  <TableRow key={r.label}>
                    <TableCell className="text-xs font-medium">{r.label}</TableCell>
                    <TableCell className="text-xs text-right">
                      <span className="font-semibold">{r.isPct ? pct(r.cur) : fmt(r.cur)}</span>
                      {" "}{compArrow(r.cur, r.prev)}
                    </TableCell>
                    <TableCell className="text-xs text-right text-muted-foreground">
                      {r.prev !== undefined ? (r.isPct ? pct(r.prev) : fmt(r.prev)) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Liquidity moved to Balance tab */}
    </div>
  );
}

function IndexCard({ icon, title, value, color, desc }: { icon: React.ReactNode; title: string; value: string; color: string; desc: string }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-xs font-semibold uppercase tracking-wide">{title}</span>
        </div>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        <p className="text-[11px] text-muted-foreground leading-snug">{desc}</p>
      </CardContent>
    </Card>
  );
}
