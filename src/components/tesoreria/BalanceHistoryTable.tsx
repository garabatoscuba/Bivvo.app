import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowUpDown, ChevronLeft, ChevronRight, Search,
  ShoppingCart, Wrench, ArrowDownToLine, ArrowUpFromLine, Users, Eye,
} from "lucide-react";
import MovementDetailSheet from "./MovementDetailSheet";

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
  paymentMethod?: string;
  origin?: string;
  category?: string;
  ref?: string;
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

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  venta_producto: { icon: <ShoppingCart className="h-3 w-3" />, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  venta_servicio: { icon: <Wrench className="h-3 w-3" />, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  inyeccion: { icon: <ArrowDownToLine className="h-3 w-3" />, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  gasto: { icon: <ArrowUpFromLine className="h-3 w-3" />, color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  salario: { icon: <Users className="h-3 w-3" />, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
};

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  cash: "Efectivo",
  transferencia: "Transfer.",
  transfer: "Transfer.",
  mixto: "Mixto",
  mixed: "Mixto",
};

export default function BalanceHistoryTable({ businessId, branchId, period }: Props) {
  const { from, to } = useMemo(() => getDateRange(period), [period]);
  const [filterType, setFilterType] = useState("all");
  const [filterPayment, setFilterPayment] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(0);
  const [selectedRow, setSelectedRow] = useState<(UnifiedRow & { balance: number }) | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useMemo(() => setPage(0), [period, filterType, filterPayment, searchText]);

  // 1. Product sales
  const { data: productSalesRows = [] } = useQuery({
    queryKey: ["bh-sales", businessId, branchId, period],
    queryFn: async () => {
      let q = supabase
        .from("sales")
        .select("id, created_at, total, sale_number, payment_type, user_id")
        .eq("status", "completed");
      if (branchId) q = q.eq("branch_id", branchId);
      if (from) q = q.gte("created_at", from);
      q = q.lte("created_at", to).order("created_at", { ascending: false }).limit(500);
      const { data } = await q;
      return (data || []).map((s: any): UnifiedRow => ({
        id: "sale-" + s.id,
        date: s.created_at,
        type: "venta_producto",
        typeLabel: "Venta",
        description: "Venta de producto",
        ref: s.sale_number || undefined,
        amount: Number(s.total),
        isIncome: true,
        paymentMethod: s.payment_type,
        origin: s.user_id,
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
        .select("id, created_at, amount, payment_type, user_id, service_categories(name)")
        .eq("business_id", businessId);
      if (branchId) q = q.eq("branch_id", branchId);
      if (from) q = q.gte("created_at", from);
      q = q.lte("created_at", to).order("created_at", { ascending: false }).limit(500);
      const { data } = await q;
      return (data || []).map((s: any): UnifiedRow => ({
        id: "svc-" + s.id,
        date: s.created_at,
        type: "venta_servicio",
        typeLabel: "Servicio",
        description: s.service_categories?.name || "Servicio",
        amount: Number(s.amount),
        isIncome: true,
        paymentMethod: s.payment_type,
        origin: s.user_id,
      }));
    },
    enabled: !!businessId,
  });

  // 3. Treasury movements
  const { data: treasuryRows = [] } = useQuery({
    queryKey: ["bh-treasury", businessId, period],
    queryFn: async () => {
      let q = supabase
        .from("treasury_movements" as any)
        .select("id, created_at, amount, movement_type, reason, payment_method, origin, treasury_categories(name)")
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
          typeLabel: isInj ? "Inyección" : "Gasto",
          description: m.reason || (isInj ? "Inyección de capital" : "Extracción"),
          category: m.treasury_categories?.name,
          amount: Number(m.amount),
          isIncome: isInj,
          paymentMethod: m.payment_method,
          origin: m.origin,
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
        .select("id, created_at, amount, employee_name, payment_method")
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
        paymentMethod: r.payment_method,
      }));
    },
    enabled: !!businessId,
  });

  // Resolve user names for origins
  const allUserIds = useMemo(() => {
    const ids = new Set<string>();
    [...productSalesRows, ...serviceSalesRows].forEach(r => { if (r.origin) ids.add(r.origin); });
    return [...ids];
  }, [productSalesRows, serviceSalesRows]);

  const { data: userNameMap = {} } = useQuery({
    queryKey: ["bh-user-names", allUserIds],
    queryFn: async () => {
      if (!allUserIds.length) return {};
      const map: Record<string, string> = {};
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", allUserIds);
      profiles?.forEach(p => { if (p.full_name) map[p.user_id] = p.full_name; });
      const missing = allUserIds.filter(id => !map[id]);
      if (missing.length) {
        const { data: emps } = await supabase.from("employees").select("auth_user_id, full_name").in("auth_user_id", missing);
        emps?.forEach(e => { if (e.auth_user_id && e.full_name) map[e.auth_user_id] = e.full_name; });
      }
      return map;
    },
    enabled: allUserIds.length > 0,
  });

  // Combine and sort
  const allRows = useMemo(() => {
    const combined = [...productSalesRows, ...serviceSalesRows, ...treasuryRows, ...salaryRows];
    combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
    const search = searchText.toLowerCase().trim();
    return allRows.filter((r) => {
      if (filterType === "ingresos" && !r.isIncome) return false;
      if (filterType === "gastos" && r.isIncome) return false;
      if (filterType !== "all" && filterType !== "ingresos" && filterType !== "gastos" && r.type !== filterType) return false;
      if (filterPayment !== "all") {
        const pm = (r.paymentMethod || "").toLowerCase();
        if (filterPayment === "efectivo" && pm !== "efectivo" && pm !== "cash") return false;
        if (filterPayment === "transferencia" && pm !== "transferencia" && pm !== "transfer") return false;
        if (filterPayment === "mixto" && pm !== "mixto" && pm !== "mixed") return false;
      }
      if (search) {
        const haystack = [r.description, r.ref, r.category, r.typeLabel, r.origin, userNameMap[r.origin || ""]].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [allRows, filterType, filterPayment, searchText, userNameMap]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const fmt = (n: number) => "$" + Math.abs(n).toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const resolveOriginName = (row: UnifiedRow) => {
    if (row.type === "salario") return row.description;
    if (row.type === "gasto" || row.type === "inyeccion") return row.origin || "Dueño";
    if (row.origin && userNameMap[row.origin]) return userNameMap[row.origin];
    return "—";
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
        Movimientos del Período
      </h3>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px] max-w-[260px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar referencia, descripción…"
            className="h-8 text-xs pl-8"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-8 text-xs w-[130px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tipo: Todos</SelectItem>
            <SelectItem value="ingresos">Solo Ingresos</SelectItem>
            <SelectItem value="gastos">Solo Gastos</SelectItem>
            <SelectItem value="venta_producto">Ventas P.</SelectItem>
            <SelectItem value="venta_servicio">Servicios</SelectItem>
            <SelectItem value="inyeccion">Inyecciones</SelectItem>
            <SelectItem value="gasto">Gastos</SelectItem>
            <SelectItem value="salario">Salarios</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPayment} onValueChange={setFilterPayment}>
          <SelectTrigger className="h-8 text-xs w-[130px]">
            <SelectValue placeholder="Pago" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Pago: Todos</SelectItem>
            <SelectItem value="efectivo">Efectivo</SelectItem>
            <SelectItem value="transferencia">Transferencia</SelectItem>
            <SelectItem value="mixto">Mixto</SelectItem>
          </SelectContent>
        </Select>
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
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs">Ref.</TableHead>
                  <TableHead className="text-xs">Fecha</TableHead>
                  <TableHead className="text-xs">Descripción</TableHead>
                  <TableHead className="text-xs">Responsable</TableHead>
                  <TableHead className="text-xs">Categoría</TableHead>
                  <TableHead className="text-xs">Pago</TableHead>
                  <TableHead className="text-xs text-right">Monto</TableHead>
                  <TableHead className="text-xs text-right">Balance</TableHead>
                  <TableHead className="text-xs w-[36px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row) => {
                  const config = TYPE_CONFIG[row.type] || TYPE_CONFIG.gasto;
                  return (
                    <TableRow key={row.id} className="group cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedRow(row); setDetailOpen(true); }}>
                      <TableCell className="py-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${config.color}`}>
                          {config.icon}
                          {row.typeLabel}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs py-2 text-muted-foreground font-mono">
                        {row.ref || "—"}
                      </TableCell>
                      <TableCell className="text-xs py-2 whitespace-nowrap">
                        {format(new Date(row.date), "dd/MM/yy HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell className="text-xs py-2 max-w-[180px] truncate">
                        {row.description}
                      </TableCell>
                      <TableCell className="text-xs py-2 max-w-[120px] truncate">
                        {resolveOriginName(row)}
                      </TableCell>
                      <TableCell className="text-xs py-2">
                        {row.category ? (
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {row.category}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs py-2">
                        {row.paymentMethod ? (
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            {PAYMENT_LABELS[row.paymentMethod.toLowerCase()] || row.paymentMethod}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                      <TableCell className={`text-xs py-2 text-right font-semibold whitespace-nowrap ${
                        row.isIncome ? "text-green-600" : "text-red-600"
                      }`}>
                        {row.isIncome ? "+" : "-"}{fmt(row.amount)}
                      </TableCell>
                      <TableCell className={`text-xs py-2 text-right font-medium whitespace-nowrap ${
                        row.balance >= 0 ? "text-foreground" : "text-destructive"
                      }`}>
                        {fmt(row.balance)}
                      </TableCell>
                      <TableCell className="py-2">
                        <Eye className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{filtered.length} movimientos</span>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2">{page + 1} / {totalPages}</span>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <MovementDetailSheet
        row={selectedRow}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        resolvedName={selectedRow ? resolveOriginName(selectedRow) : "—"}
      />
    </div>
  );
}
