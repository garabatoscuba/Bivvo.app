import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, startOfDay, startOfWeek, startOfMonth, addDays, addWeeks, addMonths, isBefore, endOfDay } from "date-fns";
import { es } from "date-fns/locale";

type Period = "today" | "week" | "month" | "all";

interface Props {
  businessId: string;
  branchId?: string | null;
  period: Period;
}

function getDateRange(period: Period): { from: Date | null; to: Date } {
  const now = new Date();
  if (period === "all") {
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    return { from: sixMonthsAgo, to: now };
  }
  const d = new Date(now);
  if (period === "today") d.setHours(0, 0, 0, 0);
  else if (period === "week") d.setDate(d.getDate() - 7);
  else if (period === "month") d.setDate(d.getDate() - 30);
  return { from: d, to: now };
}

function generateBuckets(period: Period, from: Date, to: Date): { key: string; label: string; start: Date; end: Date }[] {
  const buckets: { key: string; label: string; start: Date; end: Date }[] = [];

  if (period === "today" || period === "week") {
    // Group by day
    let current = startOfDay(from);
    while (isBefore(current, to) || current.getTime() === startOfDay(to).getTime()) {
      buckets.push({
        key: format(current, "yyyy-MM-dd"),
        label: format(current, "dd MMM", { locale: es }),
        start: startOfDay(current),
        end: endOfDay(current),
      });
      current = addDays(current, 1);
    }
  } else if (period === "month") {
    // Group by week
    let current = startOfWeek(from, { weekStartsOn: 1 });
    while (isBefore(current, to)) {
      const weekEnd = addDays(current, 6);
      buckets.push({
        key: format(current, "yyyy-'W'ww"),
        label: `${format(current, "dd", { locale: es })}-${format(weekEnd, "dd MMM", { locale: es })}`,
        start: current,
        end: endOfDay(weekEnd),
      });
      current = addWeeks(current, 1);
    }
  } else {
    // all: Group by month
    let current = startOfMonth(from);
    while (isBefore(current, to)) {
      const monthEnd = addMonths(current, 1);
      buckets.push({
        key: format(current, "yyyy-MM"),
        label: format(current, "MMM yy", { locale: es }),
        start: current,
        end: endOfDay(addDays(monthEnd, -1)),
      });
      current = monthEnd;
    }
  }

  return buckets;
}

export default function BalanceIncomeExpenseChart({ businessId, branchId, period }: Props) {
  const range = useMemo(() => getDateRange(period), [period]);
  const fromStr = range.from?.toISOString() || null;
  const toStr = range.to.toISOString();

  const { data: businessBranchIds = [] } = useQuery({
    queryKey: ["bp-branch-ids", businessId],
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("id").eq("business_id", businessId);
      return (data || []).map((b) => b.id);
    },
    enabled: !!businessId,
    staleTime: 5 * 60 * 1000,
  });

  const saleBranchIds = branchId ? [branchId] : businessBranchIds;

  // Fetch sales with dates
  const { data: salesData = [] } = useQuery({
    queryKey: ["chart-sales", businessId, branchId, period, saleBranchIds],
    queryFn: async () => {
      if (saleBranchIds.length === 0) return [];
      let q = supabase.from("sales").select("total, created_at").eq("status", "completed").in("branch_id", saleBranchIds);
      if (fromStr) q = q.gte("created_at", fromStr);
      q = q.lte("created_at", toStr);
      const { data } = await q;
      return data || [];
    },
    enabled: !!businessId && saleBranchIds.length > 0,
  });

  // Fetch services with dates
  const { data: servicesData = [] } = useQuery({
    queryKey: ["chart-services", businessId, branchId, period],
    queryFn: async () => {
      let q = supabase.from("service_entries").select("amount, created_at").eq("business_id", businessId);
      if (branchId) q = q.eq("branch_id", branchId);
      if (fromStr) q = q.gte("created_at", fromStr);
      q = q.lte("created_at", toStr);
      const { data } = await q;
      return data || [];
    },
    enabled: !!businessId,
  });

  // Fetch extractions with dates
  const { data: extractionsData = [] } = useQuery({
    queryKey: ["chart-extractions", businessId, branchId, period],
    queryFn: async () => {
      let q = supabase.from("treasury_movements" as any).select("amount, created_at").eq("business_id", businessId).eq("movement_type", "extraccion");
      if (branchId) q = q.eq("branch_id", branchId);
      if (fromStr) q = q.gte("created_at", fromStr);
      q = q.lte("created_at", toStr);
      const { data } = await q;
      return (data as any[]) || [];
    },
    enabled: !!businessId,
  });

  // Fetch salaries with dates
  const { data: salariesData = [] } = useQuery({
    queryKey: ["chart-salaries", businessId, branchId, period],
    queryFn: async () => {
      let q = supabase.from("employee_salary_records" as any).select("amount, created_at").eq("business_id", businessId);
      if (branchId) q = q.eq("branch_id", branchId);
      if (fromStr) q = q.gte("created_at", fromStr);
      q = q.lte("created_at", toStr);
      const { data } = await q;
      return (data as any[]) || [];
    },
    enabled: !!businessId,
  });

  // Fetch fixed expenses paid
  const { data: fixedExpData = [] } = useQuery({
    queryKey: ["chart-fixed-expenses", businessId, period],
    queryFn: async () => {
      let q = supabase.from("accounting_expenses").select("amount, paid_at").eq("business_id", businessId).eq("expense_type", "fixed").eq("status", "paid");
      if (fromStr) q = q.gte("paid_at", fromStr);
      q = q.lte("paid_at", toStr);
      const { data } = await q;
      return data || [];
    },
    enabled: !!businessId,
  });

  const chartData = useMemo(() => {
    if (!range.from) return [];
    const buckets = generateBuckets(period, range.from, range.to);

    const assignToBucket = (dateStr: string) => {
      const ts = new Date(dateStr).getTime();
      for (const b of buckets) {
        if (ts >= b.start.getTime() && ts <= b.end.getTime()) return b.key;
      }
      return null;
    };

    const result: Record<string, { label: string; ingresos: number; gastos: number }> = {};
    buckets.forEach((b) => { result[b.key] = { label: b.label, ingresos: 0, gastos: 0 }; });

    // Income
    salesData.forEach((s: any) => {
      const k = assignToBucket(s.created_at);
      if (k && result[k]) result[k].ingresos += Number(s.total);
    });
    servicesData.forEach((s: any) => {
      const k = assignToBucket(s.created_at);
      if (k && result[k]) result[k].ingresos += Number(s.amount);
    });

    // Expenses
    extractionsData.forEach((m: any) => {
      const k = assignToBucket(m.created_at);
      if (k && result[k]) result[k].gastos += Number(m.amount);
    });
    salariesData.forEach((r: any) => {
      const k = assignToBucket(r.created_at);
      if (k && result[k]) result[k].gastos += Number(r.amount);
    });
    fixedExpData.forEach((e: any) => {
      if (!e.paid_at) return;
      const k = assignToBucket(e.paid_at);
      if (k && result[k]) result[k].gastos += Number(e.amount);
    });

    return buckets.map((b) => ({
      name: result[b.key].label,
      Ingresos: Math.round(result[b.key].ingresos * 100) / 100,
      Gastos: Math.round(result[b.key].gastos * 100) / 100,
    }));
  }, [period, range, salesData, servicesData, extractionsData, salariesData, fixedExpData]);

  if (chartData.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Ingresos vs Gastos</h3>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <Tooltip
                formatter={(value: number) => ["$" + value.toLocaleString("es", { minimumFractionDigits: 2 })]}
                contentStyle={{ fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Ingresos" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Gastos" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
