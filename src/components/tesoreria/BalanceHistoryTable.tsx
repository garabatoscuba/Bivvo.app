import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";

type Period = "today" | "week" | "month" | "all";

interface Props {
  businessId: string;
  branchId?: string | null;
  period: Period;
}

interface UnifiedRow {
  id: string;
  date: string;
  type: string;
  typeLabel: string;
  description: string;
  amount: number;
  isIncome: boolean;
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

const PAGE_SIZE = 50;

export default function BalanceHistoryTable({ businessId, branchId, period }: Props) {
  const { from, to } = useMemo(() => getDateRange(period), [period]);
  const [filterType, setFilterType] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);

  // Reset page when period/filters change
  useMemo(() => setPage(0), [period, filterType, dateFrom, dateTo]);

  // 1. Product sales
  const { data: productSalesRows = [] } = useQuery({
    queryKey: ["bh-sales", businessId, branchId, period],
    queryFn: async () => {
      let q = supabase
        .from("sales")
        .select("id, created_at, total, sale_number")
        .eq("status", "completed");
      if (branchId) q = q.eq("branch_id", branchId);
      if (from) q = q.gte("created_at", from);
      q = q.lte("created_at", to).order("created_at", { ascending: false }).limit(500);
      const { data } = await q;
      return (data || []).map((s): UnifiedRow => ({
        id: "sale-" + s.id,
        date: s.created_at,
        type: "venta_producto",
        typeLabel: "Venta P.",
        description: s.sale_number || "Venta",
        amount: Number(s.total),
        isIncome: true,
      }));
    },
    enabled: !!businessId,
  });

  // 2. Service sales
  const { data: serviceSalesRows = [] } = useQuery({
    queryKey: ["bh-services", businessId, branchId, period],
    queryFn: async () => {
      let q = supabase
        .from("service_entries")
        .select("id, created_at, amount, service_categories(name)")
        .eq("business_id", businessId);
      if (branchId) q = q.eq("branch_id", branchId);
      if (from) q = q.gte("created_at", from);
      q = q.lte("created_at", to).order("created_at", { ascending: false }).limit(500);
      const { data } = await q;
      return (data || []).map((s: any): UnifiedRow => ({
        id: "svc-" + s.id,
        date: s.created_at,
        type: "venta_servicio",
        typeLabel: "Venta S.",
        description: s.service_categories?.name || "Servicio",
        amount: Number(s.amount),
        isIncome: true,
      }));
    },
    enabled: !!businessId,
  });

  // 3. Treasury movements (injections & extractions)
  const { data: treasuryRows = [] } = useQuery({
    queryKey: ["bh-treasury", businessId, period],
    queryFn: async () => {
      let q = supabase
        .from("treasury_movements" as any)
        .select("id, created_at, amount, movement_type, reason, treasury_categories(name)")
        .eq("business_id", businessId);
      if (from) q = q.gte("created_at", from);
      q = q.lte("created_at", to).order("created_at", { ascending: false }).limit(500);
      const { data } = await q;
      return ((data as any[]) || []).map((m: any): UnifiedRow => {
        const isInj = m.movement_type === "inyeccion";
        return {
          id: "tm-" + m.id,
          date: m.created_at,
          type: isInj ? "inyeccion" : "gasto",
          typeLabel: isInj ? "Inyecc." : "Gasto",
          description: m.treasury_categories?.name || m.reason || (isInj ? "Inyección" : "Extracción"),
          amount: Number(m.amount),
          isIncome: isInj,
        };
      });
    },
    enabled: !!businessId,
  });

  // 4. Salary records
  const { data: salaryRows = [] } = useQuery({
    queryKey: ["bh-salaries", businessId, branchId, period],
    queryFn: async () => {
      let q = supabase
        .from("employee_salary_records" as any)
        .select("id, created_at, amount, employee_name")
        .eq("business_id", businessId);
      if (branchId) q = q.eq("branch_id", branchId);
      if (from) q = q.gte("created_at", from);
      q = q.lte("created_at", to).order("created_at", { ascending: false }).limit(500);
      const { data } = await q;
      return ((data as any[]) || []).map((r: any): UnifiedRow => ({
        id: "sal-" + r.id,
        date: r.created_at,
        type: "salario",
        typeLabel: "Salario",
        description: r.employee_name || "Empleado",
        amount: Number(r.amount),
        isIncome: false,
      }));
    },
    enabled: !!businessId,
  });

  // Combine and sort
  const allRows = useMemo(() => {
    const combined = [...productSalesRows, ...serviceSalesRows, ...treasuryRows, ...salaryRows];
    combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Calculate running balance (from oldest to newest, then reverse)
    const sorted = [...combined].reverse();
    let balance = 0;
    const withBalance = sorted.map((row) => {
      balance += row.isIncome ? row.amount : -row.amount;
      return { ...row, balance };
    });
    withBalance.reverse();
    return withBalance;
  }, [productSalesRows, serviceSalesRows, treasuryRows, salaryRows]);

  // Apply filters
  const filtered = useMemo(() => {
    return allRows.filter((r) => {
      if (filterType === "ingresos" && !r.isIncome) return false;
      if (filterType === "gastos" && r.isIncome) return false;
      if (dateFrom) {
        const d = r.date.split("T")[0];
        if (d < dateFrom) return false;
      }
      if (dateTo) {
        const d = r.date.split("T")[0];
        if (d > dateTo) return false;
      }
      return true;
    });
  }, [allRows, filterType, dateFrom, dateTo]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const fmt = (n: number) => "$" + Math.abs(n).toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
        Movimientos del Período
      </h3>

      {/* Filters */}
      <div className="grid grid-cols-3 gap-2">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ingresos">Ingresos</SelectItem>
            <SelectItem value="gastos">Gastos</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          className="h-8 text-xs"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <Input
          type="date"
          className="h-8 text-xs"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <ArrowUpDown className="h-7 w-7 opacity-40 mx-auto mb-2" />
            <p className="text-sm">Sin movimientos en este período</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-[80px]">Fecha</TableHead>
                  <TableHead className="text-xs w-[80px]">Tipo</TableHead>
                  <TableHead className="text-xs">Descripción</TableHead>
                  <TableHead className="text-xs text-right w-[100px]">Monto</TableHead>
                  <TableHead className="text-xs text-right w-[100px]">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs py-2">
                      {format(new Date(row.date), "dd/MM", { locale: es })}
                    </TableCell>
                    <TableCell className="text-xs py-2">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        row.isIncome
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}>
                        {row.typeLabel}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs py-2 truncate max-w-[150px]">
                      {row.description}
                    </TableCell>
                    <TableCell className={`text-xs py-2 text-right font-semibold ${
                      row.isIncome ? "text-green-600" : "text-red-600"
                    }`}>
                      {row.isIncome ? "+" : "-"}{fmt(row.amount)}
                    </TableCell>
                    <TableCell className={`text-xs py-2 text-right font-medium ${
                      row.balance >= 0 ? "text-foreground" : "text-destructive"
                    }`}>
                      {fmt(row.balance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{filtered.length} movimientos</span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
