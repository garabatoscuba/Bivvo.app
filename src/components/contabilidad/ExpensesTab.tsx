import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuditLog } from "@/hooks/useAuditLog";
import { toast } from "sonner";
import { format, addDays, addWeeks, addMonths, addYears, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isBefore, parseISO, subDays, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Plus, AlertTriangle, Check, Pencil, Trash2, Upload, Receipt, Droplets, ArrowUpDown } from "lucide-react";

// ── Types ──
type Expense = {
  id: string;
  business_id: string;
  branch_id: string | null;
  name: string;
  amount: number;
  expense_type: string;
  frequency: string | null;
  category_id: string | null;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  description: string | null;
  receipt_url: string | null;
  created_by: string | null;
  created_at: string;
};

type Category = { id: string; name: string; business_id: string };

type PeriodKey = "month" | "quarter" | "year";

const FREQUENCIES = [
  { value: "daily", label: "Diaria" },
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quincenal" },
  { value: "monthly", label: "Mensual" },
  { value: "quarterly", label: "Trimestral" },
  { value: "annual", label: "Anual" },
];

const DEFAULT_FIXED_NAMES = ["Renta", "Electricidad", "Agua", "Gas", "Impuesto 1", "Impuesto 2"];

function getNextDueDate(current: string | null, frequency: string): string {
  const base = current ? parseISO(current) : new Date();
  switch (frequency) {
    case "daily": return addDays(base, 1).toISOString();
    case "weekly": return addWeeks(base, 1).toISOString();
    case "biweekly": return addWeeks(base, 2).toISOString();
    case "monthly": return addMonths(base, 1).toISOString();
    case "quarterly": return addMonths(base, 3).toISOString();
    case "annual": return addYears(base, 1).toISOString();
    default: return addMonths(base, 1).toISOString();
  }
}

function getPeriodRange(period: PeriodKey): { start: Date; end: Date } {
  const now = new Date();
  switch (period) {
    case "month": return { start: startOfMonth(now), end: endOfMonth(now) };
    case "quarter": return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case "year": return { start: startOfYear(now), end: endOfYear(now) };
  }
}

// ── Component ──
interface ExpensesTabProps {
  businessId: string;
  branchId: string | null;
}

const ExpensesTab = ({ businessId, branchId }: ExpensesTabProps) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const auditLog = useAuditLog();
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [expenseDialog, setExpenseDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Form state
  const [formName, setFormName] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formFrequency, setFormFrequency] = useState("monthly");
  const [formCategoryId, setFormCategoryId] = useState<string>("");
  const [formDescription, setFormDescription] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formFile, setFormFile] = useState<File | null>(null);
  const [formTipo, setFormTipo] = useState<"directo" | "indirecto" | "imprevisto">("directo");

  const resetForm = () => {
    setFormName(""); setFormAmount(""); setFormFrequency("monthly");
    setFormCategoryId(""); setFormDescription(""); setFormDueDate("");
    setFormFile(null); setEditingExpense(null); setFormTipo("directo");
  };

  // ── Queries ──
  const { data: categories = [] } = useQuery({
    queryKey: ["treasury-categories", businessId],
    queryFn: async () => {
      const { data } = await supabase
        .from("treasury_categories")
        .select("id, name, business_id")
        .eq("business_id", businessId)
        .order("sort_order");
      return (data ?? []) as Category[];
    },
  });

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["accounting-expenses", businessId, branchId],
    queryFn: async () => {
      let q = supabase
        .from("accounting_expenses")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });
      if (branchId) q = q.eq("branch_id", branchId);
      const { data } = await q;
      return (data ?? []) as Expense[];
    },
  });

  // ── Business type check for ink card ──
  const { data: business } = useQuery({
    queryKey: ["business-type", businessId],
    queryFn: async () => {
      const { data } = await supabase
        .from("businesses")
        .select("business_type")
        .eq("id", businessId)
        .single();
      return data;
    },
  });

  const isCopyShop = business?.business_type === "copy_shop";

  // ── Ink usage data (only for copy shops) ──
  const { data: inkUsage = [] } = useQuery({
    queryKey: ["ink-usage-expenses", businessId],
    queryFn: async () => {
      const { data } = await supabase
        .from("print_ink_usage")
        .select("color, cantidad_consumida, costo_por_hoja, hojas_impresas, created_at, is_automatic")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: isCopyShop,
  });

  const { data: inkInventory = [] } = useQuery({
    queryKey: ["ink-inventory-expenses", businessId],
    queryFn: async () => {
      const { data } = await supabase
        .from("print_ink_inventory")
        .select("color, cantidad, ubicacion, costo_total, created_at")
        .eq("business_id", businessId);
      return data || [];
    },
    enabled: isCopyShop,
  });

  const inkAnalysis = useMemo(() => {
    if (!isCopyShop || inkUsage.length === 0) return null;
    const colors = ["negro", "cian", "magenta", "amarillo"] as const;
    const thirtyDaysAgo = subDays(new Date(), 30);
    const now = new Date();

    const autoUsages = inkUsage.filter((r: any) => r.is_automatic);
    if (autoUsages.length === 0) return null;

    const firstDate = new Date(autoUsages[autoUsages.length - 1]?.created_at || now);
    const totalDays = Math.max(1, differenceInDays(now, firstDate));

    // Total invested in ink
    const totalInvested = inkInventory.reduce((s: number, r: any) => s + Math.max(0, Number(r.costo_total)), 0);

    // Consumption per color
    const colorData = colors.map(color => {
      const colorUsage = inkUsage.filter((r: any) => r.color === color);
      const totalConsumed = colorUsage.reduce((s: number, r: any) => s + Number(r.cantidad_consumida), 0);
      const last30 = colorUsage
        .filter((r: any) => new Date(r.created_at) >= thirtyDaysAgo)
        .reduce((s: number, r: any) => s + Number(r.cantidad_consumida), 0);
      const daysForAvg = Math.min(totalDays, 30);
      const dailyAvg = daysForAvg > 0 ? last30 / daysForAvg : totalConsumed / totalDays;

      // Stock in taller
      const tallerCost = inkInventory
        .filter((r: any) => r.color === color && r.ubicacion === "taller")
        .reduce((s: number, r: any) => s + Number(r.costo_total), 0);
      const remaining = Math.max(0, tallerCost - totalConsumed);
      const daysRemaining = dailyAvg > 0 ? Math.floor(remaining / dailyAvg) : null;

      return { color, totalConsumed, dailyAvg, remaining, daysRemaining };
    });

    const totalConsumed = colorData.reduce((s, c) => s + c.totalConsumed, 0);
    const totalRemaining = colorData.reduce((s, c) => s + c.remaining, 0);

    return { colorData, totalInvested, totalConsumed, totalRemaining };
  }, [isCopyShop, inkUsage, inkInventory]);
  // ── Seed default fixed expenses (check all fixed for business, not filtered by branch) ──
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (!businessId || seeded) return;
    // Query ALL fixed expenses for the business to avoid re-seeding
    supabase
      .from("accounting_expenses")
      .select("name")
      .eq("business_id", businessId)
      .eq("expense_type", "fixed")
      .then(({ data }) => {
        const existingNames = new Set((data ?? []).map((e: any) => e.name));
        const missing = DEFAULT_FIXED_NAMES.filter((n) => !existingNames.has(n));
        setSeeded(true);
        if (missing.length === 0) return;

        const rows = missing.map((name) => ({
          business_id: businessId,
          branch_id: branchId,
          name,
          amount: 0,
          expense_type: "fixed",
          frequency: "monthly",
          status: "pending",
          due_date: addMonths(new Date(), 1).toISOString(),
          created_by: user?.id ?? null,
        }));

        supabase.from("accounting_expenses").insert(rows).then(({ error }) => {
          if (!error) qc.invalidateQueries({ queryKey: ["accounting-expenses"] });
        });
      });
  }, [businessId, seeded]);

  // ── Period filtering ──
  const range = useMemo(() => getPeriodRange(period), [period]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const d = e.paid_at || e.due_date || e.created_at;
      if (!d) return true;
      const ts = new Date(d);
      return ts >= range.start && ts <= range.end;
    });
  }, [expenses, range]);

  const fixedExpenses = useMemo(() => expenses.filter((e) => e.expense_type === "fixed"), [expenses]);
  const unexpectedExpenses = useMemo(() => filteredExpenses.filter((e) => e.expense_type === "unexpected"), [filteredExpenses]);

  // Unified & sorted list
  const getExpenseTipo = (e: Expense): string => {
    if (e.expense_type === "unexpected") return "Imprevisto";
    if (e.expense_type === "indirect") return "Indirecto";
    return "Directo";
  };

  const allExpensesUnified = useMemo(() => {
    const combined = [...fixedExpenses, ...unexpectedExpenses];
    const col = sortColumn;
    const dir = sortDir === "asc" ? 1 : -1;
    return combined.sort((a, b) => {
      let va: any, vb: any;
      switch (col) {
        case "name": va = a.name.toLowerCase(); vb = b.name.toLowerCase(); break;
        case "amount": va = a.amount; vb = b.amount; break;
        case "frequency": va = a.frequency || ""; vb = b.frequency || ""; break;
        case "tipo": va = getExpenseTipo(a); vb = getExpenseTipo(b); break;
        case "due_date": va = a.due_date || "9999"; vb = b.due_date || "9999"; break;
        case "status": va = a.status; vb = b.status; break;
        default: va = a.name; vb = b.name;
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [fixedExpenses, unexpectedExpenses, sortColumn, sortDir]);

  const toggleSort = (col: string) => {
    if (sortColumn === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortColumn(col); setSortDir("asc"); }
  };

  // ── Summary ──
  const summary = useMemo(() => {
    const inRange = filteredExpenses;
    const paid = inRange.filter((e) => e.status === "paid").reduce((s, e) => s + e.amount, 0);
    const pending = inRange.filter((e) => e.status === "pending").reduce((s, e) => s + e.amount, 0);
    const overdue = inRange.filter((e) => e.status === "overdue").reduce((s, e) => s + e.amount, 0);
    return { paid, pending, overdue, total: paid + pending + overdue };
  }, [filteredExpenses]);

  // Overdue count
  const overdueExpenses = useMemo(() => expenses.filter((e) => e.status === "overdue"), [expenses]);

  // ── Auto-overdue check ──
  useEffect(() => {
    const now = new Date();
    const toUpdate = expenses.filter(
      (e) => e.status === "pending" && e.due_date && isBefore(parseISO(e.due_date), now)
    );
    if (toUpdate.length === 0) return;
    Promise.all(
      toUpdate.map((e) =>
        supabase.from("accounting_expenses").update({ status: "overdue" }).eq("id", e.id)
      )
    ).then(() => qc.invalidateQueries({ queryKey: ["accounting-expenses"] }));
  }, [expenses]);


  // ── Mutations ──
  const saveMutation = useMutation({
    mutationFn: async () => {
      const isUnexpected = formTipo === "imprevisto";
      const expenseType = isUnexpected ? "unexpected" : formTipo === "indirecto" ? "indirect" : "fixed";
      let receiptUrl: string | null = null;

      if (formFile) {
        setUploading(true);
        const ext = formFile.name.split(".").pop();
        const path = `${businessId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("expense-receipts")
          .upload(path, formFile, { upsert: true });
        setUploading(false);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("expense-receipts").getPublicUrl(path);
        receiptUrl = urlData.publicUrl;
      }

      const row: any = {
        business_id: businessId,
        branch_id: branchId,
        name: formName || formDescription || "Gasto",
        amount: parseFloat(formAmount) || 0,
        expense_type: expenseType,
        frequency: !isUnexpected ? formFrequency : null,
        category_id: formCategoryId && formCategoryId !== "none" ? formCategoryId : null,
        status: isUnexpected ? "paid" : "pending",
        due_date: !isUnexpected ? (formDueDate || getNextDueDate(null, formFrequency)) : (formDueDate || new Date().toISOString()),
        paid_at: isUnexpected ? new Date().toISOString() : null,
        description: formDescription || null,
        receipt_url: receiptUrl,
        created_by: user?.id ?? null,
      };

      if (editingExpense) {
        const { error } = await supabase.from("accounting_expenses").update(row).eq("id", editingExpense.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("accounting_expenses").insert(row);
        if (error) throw error;

        // Auto-create treasury movement for unexpected expenses
        if (isUnexpected && user) {
          const { error: tmErr } = await supabase.from("treasury_movements" as any).insert({
            business_id: businessId,
            branch_id: branchId,
            amount: parseFloat(formAmount) || 0,
            movement_type: "extraccion",
            label: formDescription || "Gasto imprevisto",
            category_id: formCategoryId || null,
            reason: formDescription || null,
            registered_by: user.id,
            payment_method: "cash",
            cash_amount: parseFloat(formAmount) || 0,
            transfer_amount: 0,
          });
          if (tmErr) console.error("Error creating treasury movement:", tmErr);
        }
      }
    },
    onSuccess: () => {
      toast.success(editingExpense ? "Gasto actualizado" : "Gasto registrado");
      qc.invalidateQueries({ queryKey: ["accounting-expenses"] });
      qc.invalidateQueries({ queryKey: ["treasury-movements"] });
      setExpenseDialog(false);
      resetForm();
    },
    onError: (err: any) => toast.error(err.message || "Error al guardar"),
  });

  const markPaidMutation = useMutation({
    mutationFn: async (expense: Expense) => {
      const now = new Date().toISOString();
      const nextDue = expense.frequency ? getNextDueDate(expense.due_date, expense.frequency) : null;

      // Update current expense to paid
      const { error: updateErr } = await supabase.from("accounting_expenses").update({ status: "paid", paid_at: now }).eq("id", expense.id);
      if (updateErr) throw updateErr;

      // Create treasury movement
      if (user) {
        const { error: tmErr } = await supabase.from("treasury_movements" as any).insert({
          business_id: expense.business_id,
          branch_id: expense.branch_id,
          amount: expense.amount,
          movement_type: "extraccion",
          label: expense.name,
          category_id: expense.category_id,
          reason: `Pago de gasto fijo: ${expense.name}`,
          registered_by: user.id,
          payment_method: "cash",
          cash_amount: expense.amount,
          transfer_amount: 0,
        });
        if (tmErr) {
          console.error("Error creating treasury movement for expense:", tmErr);
          throw tmErr;
        }
      }

      // Generate next occurrence for fixed recurring
      if (expense.expense_type === "fixed" && nextDue) {
        await supabase.from("accounting_expenses").insert({
          business_id: expense.business_id,
          branch_id: expense.branch_id,
          name: expense.name,
          amount: expense.amount,
          expense_type: "fixed",
          frequency: expense.frequency,
          category_id: expense.category_id,
          status: "pending",
          due_date: nextDue,
          created_by: user?.id ?? null,
        });
      }
    },
    onSuccess: (_data, expense) => {
      toast.success("Gasto marcado como pagado");
      qc.invalidateQueries({ queryKey: ["accounting-expenses"] });
      qc.invalidateQueries({ queryKey: ["treasury-movements"] });
      qc.invalidateQueries({ queryKey: ["bh-treasury"] });
      qc.invalidateQueries({ queryKey: ["bp-injections"] });
      auditLog(
        'expense_paid',
        `Gasto '${expense.name}' marcado como pagado por $${expense.amount.toLocaleString()}`,
        expense.id,
        'accounting_expense'
      );
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("accounting_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Gasto eliminado");
      qc.invalidateQueries({ queryKey: ["accounting-expenses"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openEditExpense = (e: Expense) => {
    setEditingExpense(e);
    setFormName(e.name);
    setFormAmount(String(e.amount));
    setFormFrequency(e.frequency || "monthly");
    setFormCategoryId(e.category_id || "");
    setFormDescription(e.description || "");
    setFormDueDate(e.due_date ? format(parseISO(e.due_date), "yyyy-MM-dd") : "");
    setFormTipo(e.expense_type === "unexpected" ? "imprevisto" : e.expense_type === "indirect" ? "indirecto" : "directo");
    setExpenseDialog(true);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "paid": return <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30">Pagado</Badge>;
      case "overdue": return <Badge variant="destructive">Vencido</Badge>;
      default: return <Badge variant="secondary">Pendiente</Badge>;
    }
  };

  const getCategoryName = (id: string | null) => categories.find((c) => c.id === id)?.name || "—";

  const freqLabel = (f: string | null) => FREQUENCIES.find((x) => x.value === f)?.label || "—";

  return (
    <div className="space-y-6">
      {/* Overdue alert */}
      {overdueExpenses.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Tienes <strong>{overdueExpenses.length}</strong> gasto{overdueExpenses.length > 1 ? "s" : ""} vencido{overdueExpenses.length > 1 ? "s" : ""} por un total de <strong>${overdueExpenses.reduce((s, e) => s + e.amount, 0).toLocaleString()}</strong>
          </AlertDescription>
        </Alert>
      )}

      {/* Period selector */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">Resumen del Período</h2>
        <ToggleGroup type="single" value={period} onValueChange={(v) => v && setPeriod(v as PeriodKey)} className="border border-border bg-card">
          <ToggleGroupItem value="month" className="text-xs px-3">Este mes</ToggleGroupItem>
          <ToggleGroupItem value="quarter" className="text-xs px-3">Este trimestre</ToggleGroupItem>
          <ToggleGroupItem value="year" className="text-xs px-3">Este año</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Pagado", value: summary.paid, color: "text-green-600 dark:text-green-400" },
          { label: "Total Pendiente", value: summary.pending, color: "text-muted-foreground" },
          { label: "Total Vencido", value: summary.overdue, color: "text-destructive" },
          { label: "Total del Período", value: summary.total, color: "text-foreground" },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className={`text-xl font-bold ${c.color}`}>${c.value.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── INK EXPENSE CARD (copy_shop only) ── */}
      {isCopyShop && (
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Droplets className="h-4 w-4" /> Gasto de Tinta
          </h3>
          {!inkAnalysis ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                <Droplets className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Registra cobros en Impresiones para ver el análisis de consumo de tinta.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Invertido</p>
                    <p className="text-lg font-bold">${inkAnalysis.totalInvested.toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Consumido</p>
                    <p className="text-lg font-bold text-destructive">${inkAnalysis.totalConsumed.toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Restante</p>
                    <p className={`text-lg font-bold ${inkAnalysis.totalRemaining <= 0 ? 'text-destructive' : 'text-primary'}`}>
                      ${inkAnalysis.totalRemaining.toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Color</TableHead>
                          <TableHead className="text-right">Consumo/día</TableHead>
                          <TableHead className="text-right">Consumido</TableHead>
                          <TableHead className="text-right">Restante</TableHead>
                          <TableHead className="text-right">Días rest.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inkAnalysis.colorData.map((c) => {
                          const colorStyles: Record<string, string> = {
                            negro: "bg-gray-900 dark:bg-gray-600",
                            cian: "bg-cyan-500",
                            magenta: "bg-pink-500",
                            amarillo: "bg-yellow-400",
                          };
                          const colorLabels: Record<string, string> = {
                            negro: "Negro", cian: "Cian", magenta: "Magenta", amarillo: "Amarillo",
                          };
                          return (
                            <TableRow key={c.color}>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  <div className={`h-3 w-3 rounded-full ${colorStyles[c.color] || ""}`} />
                                  <span className="text-sm font-medium">{colorLabels[c.color] || c.color}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                ${c.dailyAvg.toFixed(2)}<span className="text-muted-foreground">/día</span>
                              </TableCell>
                              <TableCell className="text-right text-sm text-destructive">
                                ${c.totalConsumed.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                ${c.remaining.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right">
                                {c.daysRemaining !== null ? (
                                  <Badge variant={c.daysRemaining <= 7 ? "destructive" : c.daysRemaining <= 15 ? "secondary" : "default"} className="text-xs">
                                    {c.daysRemaining}d
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}


      {/* ── UNIFIED EXPENSES TABLE ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold">Todos los Gastos</h3>
          <Button size="sm" onClick={() => { resetForm(); setExpenseDialog(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nuevo Gasto
          </Button>
        </div>
        <Card>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                    <span className="inline-flex items-center gap-1">Nombre <ArrowUpDown className="h-3 w-3 text-muted-foreground" /></span>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("amount")}>
                    <span className="inline-flex items-center gap-1 justify-end">Monto <ArrowUpDown className="h-3 w-3 text-muted-foreground" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("frequency")}>
                    <span className="inline-flex items-center gap-1">Frecuencia <ArrowUpDown className="h-3 w-3 text-muted-foreground" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("tipo")}>
                    <span className="inline-flex items-center gap-1">Tipo <ArrowUpDown className="h-3 w-3 text-muted-foreground" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("due_date")}>
                    <span className="inline-flex items-center gap-1">Próximo venc. <ArrowUpDown className="h-3 w-3 text-muted-foreground" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("status")}>
                    <span className="inline-flex items-center gap-1">Estado <ArrowUpDown className="h-3 w-3 text-muted-foreground" /></span>
                  </TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allExpensesUnified.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin gastos registrados</TableCell></TableRow>
                ) : allExpensesUnified.map((e) => {
                  const tipo = getExpenseTipo(e);
                  const tipoBadgeClass = tipo === "Imprevisto"
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                    : tipo === "Indirecto"
                    ? "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30"
                    : "bg-muted text-foreground";
                  return (
                    <TableRow key={e.id} className={e.status === "overdue" ? "bg-destructive/5" : ""}>
                      <TableCell className="font-medium max-w-[200px] truncate">{e.name}</TableCell>
                      <TableCell className="text-right">${e.amount.toLocaleString()}</TableCell>
                      <TableCell>{freqLabel(e.frequency)}</TableCell>
                      <TableCell><Badge className={tipoBadgeClass}>{tipo}</Badge></TableCell>
                      <TableCell>{e.due_date ? format(parseISO(e.due_date), "dd MMM yyyy", { locale: es }) : "—"}</TableCell>
                      <TableCell>{statusBadge(e.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {e.status !== "paid" && e.expense_type !== "unexpected" && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => markPaidMutation.mutate(e)} title="Marcar pagado">
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditExpense(e)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteConfirmId(e.id)} title="Eliminar">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* ── Unified Expense Dialog ── */}
      <Dialog open={expenseDialog} onOpenChange={(o) => { if (!o) resetForm(); setExpenseDialog(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Editar Gasto" : "Nuevo Gasto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo <span className="text-destructive">*</span></Label>
              <Select value={formTipo} onValueChange={(v) => setFormTipo(v as "directo" | "indirecto" | "imprevisto")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="directo">Directo</SelectItem>
                  <SelectItem value="indirecto">Indirecto</SelectItem>
                  <SelectItem value="imprevisto">Imprevisto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{formTipo === "imprevisto" ? "Descripción" : "Nombre"}</Label>
              {formTipo === "imprevisto" ? (
                <Textarea value={formDescription || formName} onChange={(e) => { setFormDescription(e.target.value); setFormName(e.target.value); }} placeholder="Describe el gasto..." />
              ) : (
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ej: Internet" />
              )}
            </div>
            <div>
              <Label>Monto</Label>
              <Input type="number" min="0" step="0.01" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="0.00" />
            </div>
            {formTipo !== "imprevisto" && (
              <div>
                <Label>Frecuencia</Label>
                <Select value={formFrequency} onValueChange={setFormFrequency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>{formTipo === "imprevisto" ? "Fecha" : "Próximo vencimiento"}</Label>
              <Input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} />
            </div>
            {formTipo === "imprevisto" && (
              <div>
                <Label>Comprobante (opcional)</Label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => document.getElementById("receipt-input")?.click()}>
                    <Upload className="h-4 w-4" /> {formFile ? formFile.name : "Adjuntar archivo"}
                  </Button>
                  <input id="receipt-input" type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setFormFile(e.target.files?.[0] || null)} />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setExpenseDialog(false); resetForm(); }}>Cancelar</Button>
            <Button disabled={!(formName || formDescription) || !formAmount || saveMutation.isPending || uploading} onClick={() => saveMutation.mutate()}>
              {uploading ? "Subiendo..." : saveMutation.isPending ? "Guardando..." : editingExpense ? "Actualizar" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(o) => { if (!o) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar este gasto?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Esta acción no se puede deshacer.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => {
              if (deleteConfirmId) {
                deleteMutation.mutate(deleteConfirmId, { onSuccess: () => setDeleteConfirmId(null) });
              }
            }}>
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExpensesTab;
