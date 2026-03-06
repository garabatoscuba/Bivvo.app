import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, ShoppingCart, Wrench, ArrowDownToLine, Package, Users, ArrowUpFromLine, ReceiptText } from "lucide-react";

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

export default function BalancePersonalCards({ businessId, branchId, period, mode }: Props) {
  const { from, to } = useMemo(() => getDateRange(period), [period]);

  // Product sales (from sales table, completed only)
  const { data: productSales = 0 } = useQuery({
    queryKey: ["bp-product-sales", businessId, branchId, period],
    queryFn: async () => {
      let q = supabase
        .from("sales")
        .select("total")
        .eq("status", "completed");
      if (branchId) q = q.eq("branch_id", branchId);
      if (from) q = q.gte("created_at", from);
      q = q.lte("created_at", to);
      const { data } = await q;
      return data?.reduce((sum, s) => sum + Number(s.total), 0) || 0;
    },
    enabled: !!businessId,
  });

  // Service sales (from service_entries)
  const { data: serviceSales = 0 } = useQuery({
    queryKey: ["bp-service-sales", businessId, branchId, period],
    queryFn: async () => {
      let q = supabase
        .from("service_entries")
        .select("amount")
        .eq("business_id", businessId);
      if (branchId) q = q.eq("branch_id", branchId);
      if (from) q = q.gte("created_at", from);
      q = q.lte("created_at", to);
      const { data } = await q;
      return data?.reduce((sum, s) => sum + Number(s.amount), 0) || 0;
    },
    enabled: !!businessId,
  });

  // Injections (treasury_movements type inyeccion)
  const { data: injections = 0 } = useQuery({
    queryKey: ["bp-injections", businessId, branchId, period],
    queryFn: async () => {
      let q = supabase
        .from("treasury_movements" as any)
        .select("amount")
        .eq("business_id", businessId)
        .eq("movement_type", "inyeccion");
      if (branchId) q = q.eq("branch_id", branchId);
      if (from) q = q.gte("created_at", from);
      q = q.lte("created_at", to);
      const { data } = await q;
      return (data as any[])?.reduce((sum: number, m: any) => sum + Number(m.amount), 0) || 0;
    },
    enabled: !!businessId,
  });

  // COGS (Operativo): sum of (quantity * cost_price) from sale_items of completed sales
  const { data: productCost = 0 } = useQuery({
    queryKey: ["bp-product-cost", businessId, branchId, period],
    queryFn: async () => {
      let sq = supabase
        .from("sales")
        .select("id")
        .eq("status", "completed");
      if (branchId) sq = sq.eq("branch_id", branchId);
      if (from) sq = sq.gte("created_at", from);
      sq = sq.lte("created_at", to);
      const { data: sales } = await sq;
      if (!sales || sales.length === 0) return 0;

      const saleIds = sales.map((s: any) => s.id);
      let total = 0;
      for (let i = 0; i < saleIds.length; i += 50) {
        const chunk = saleIds.slice(i, i + 50);
        const { data: items } = await supabase
          .from("sale_items")
          .select("quantity, cost_price")
          .in("sale_id", chunk);
        total += (items || []).reduce((sum: number, it: any) => sum + Number(it.quantity) * Number(it.cost_price || 0), 0);
      }
      return total;
    },
    enabled: !!businessId && mode === "operativo",
  });

  // Inventory purchases (Real): sum of (unit_cost * quantity) from product_stock_entries
  const { data: inventoryPurchases = 0 } = useQuery({
    queryKey: ["bp-inventory-purchases", businessId, branchId, period],
    queryFn: async () => {
      let q = supabase
        .from("product_stock_entries")
        .select("unit_cost, quantity")
        .eq("business_id", businessId);
      if (branchId) q = q.eq("branch_id", branchId);
      if (from) q = q.gte("created_at", from);
      q = q.lte("created_at", to);
      const { data } = await q;
      return (data || []).reduce((sum: number, e: any) => sum + Number(e.unit_cost || 0) * Number(e.quantity || 0), 0);
    },
    enabled: !!businessId && mode === "real",
  });

  // Salaries paid (from employee_salary_records)
  const { data: salariesPaid = 0 } = useQuery({
    queryKey: ["bp-salaries", businessId, branchId, period],
    queryFn: async () => {
      let q = supabase
        .from("employee_salary_records" as any)
        .select("amount")
        .eq("business_id", businessId);
      if (branchId) q = q.eq("branch_id", branchId);
      if (from) q = q.gte("created_at", from);
      q = q.lte("created_at", to);
      const { data } = await q;
      return (data as any[])?.reduce((sum: number, r: any) => sum + Number(r.amount), 0) || 0;
    },
    enabled: !!businessId,
  });

  // Extractions (treasury_movements type extraccion)
  const { data: extractionData } = useQuery({
    queryKey: ["bp-extractions", businessId, branchId, period],
    queryFn: async () => {
      let q = supabase
        .from("treasury_movements" as any)
        .select("amount, category_id")
        .eq("business_id", businessId)
        .eq("movement_type", "extraccion");
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

  const extractions = extractionData || { retiro: 0, otros: 0, total: 0 };
  const totalIngresos = productSales + serviceSales + injections;

  // Disponible formula: ingresos - salarios - extracciones (COGS never enters)
  // In Real mode, inventory purchases also subtract
  const compromisos = salariesPaid + extractions.total;
  const disponible = mode === "real"
    ? totalIngresos - compromisos - inventoryPurchases
    : totalIngresos - compromisos;

  // Total gastos for display (includes informational COGS or inventory)
  const totalGastosDisplay = mode === "real"
    ? inventoryPurchases + salariesPaid + extractions.total
    : productCost + salariesPaid + extractions.total;

  const fmt = (n: number) => "$" + n.toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
          <div className="space-y-1.5 pl-9">
            <Row icon={<ShoppingCart className="h-3.5 w-3.5" />} label="Ventas de Productos" value={fmt(productSales)} />
            <Row icon={<Wrench className="h-3.5 w-3.5" />} label="Ventas de Servicios" value={fmt(serviceSales)} />
            <Row icon={<ArrowDownToLine className="h-3.5 w-3.5" />} label="Inyecciones" value={fmt(injections)} />
          </div>
          <div className="border-t pt-2 pl-9 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Total Ingresos</span>
            <span className="text-base font-bold text-green-600">{fmt(totalIngresos)}</span>
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
          <div className="space-y-1.5 pl-9">
            {mode === "operativo" ? (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Package className="h-3.5 w-3.5" />
                  <span>Costo de productos vendidos <span className="text-xs text-muted-foreground/60 italic">(recuperado en ventas)</span></span>
                </div>
                <span className="font-semibold text-muted-foreground">{fmt(productCost)}</span>
              </div>
            ) : (
              <Row icon={<Package className="h-3.5 w-3.5" />} label="Compras de inventario" value={fmt(inventoryPurchases)} />
            )}
            <Row icon={<Users className="h-3.5 w-3.5" />} label="Salarios pagados" value={fmt(salariesPaid)} />
            <Row icon={<ArrowUpFromLine className="h-3.5 w-3.5" />} label="Dinero que sacaste" value={fmt(extractions?.retiro || 0)} />
            <Row icon={<ReceiptText className="h-3.5 w-3.5" />} label="Otros gastos" value={fmt(extractions?.otros || 0)} />
          </div>
          <div className="border-t pt-2 pl-9 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Total Gastos</span>
            <span className="text-base font-bold text-red-600">{fmt(totalGastosDisplay)}</span>
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

function Row({ icon, label, value, placeholder }: { icon: React.ReactNode; label: string; value: string | null; placeholder?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      {value ? (
        <span className="font-semibold">{value}</span>
      ) : (
        <span className="text-xs text-muted-foreground/60 italic">{placeholder || "$0.00"}</span>
      )}
    </div>
  );
}
