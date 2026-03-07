import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, addDays, addWeeks, addMonths, addYears, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isBefore, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
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
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Plus, AlertTriangle, Check, Pencil, Trash2, Upload, Receipt } from "lucide-react";

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
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [fixedDialog, setFixedDialog] = useState(false);
  const [unexpectedDialog, setUnexpectedDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formFrequency, setFormFrequency] = useState("monthly");
  const [formCategoryId, setFormCategoryId] = useState<string>("");
  const [formDescription, setFormDescription] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formFile, setFormFile] = useState<File | null>(null);

  const resetForm = () => {
    setFormName(""); setFormAmount(""); setFormFrequency("monthly");
    setFormCategoryId(""); setFormDescription(""); setFormDueDate("");
    setFormFile(null); setEditingExpense(null);
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

  // ── Seed default fixed expenses ──
  useEffect(() => {
    if (!businessId || isLoading) return;
    const existingFixed = expenses.filter((e) => e.expense_type === "fixed");
    const existingNames = new Set(existingFixed.map((e) => e.name));
    const missing = DEFAULT_FIXED_NAMES.filter((n) => !existingNames.has(n));
    if (missing.length === 0) return;

    const rows = missing.map((name) => ({
      business_id: businessId,
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
  }, [businessId, isLoading, expenses.length]);

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

  // ── Chart data ──
  const chartData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach((e) => {
      const cat = categories.find((c) => c.id === e.category_id);
      const name = cat?.name || "Sin categoría";
      map[name] = (map[name] || 0) + e.amount;
    });
    return Object.entries(map).map(([name, total]) => ({ name, total }));
  }, [filteredExpenses, categories]);

  const chartConfig = {
    total: { label: "Monto", color: "hsl(var(--primary))" },
  };

  // ── Mutations ──
  const saveMutation = useMutation({
    mutationFn: async (type: "fixed" | "unexpected") => {
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
        name: type === "fixed" ? formName : formDescription || "Gasto imprevisto",
        amount: parseFloat(formAmount) || 0,
        expense_type: type,
        frequency: type === "fixed" ? formFrequency : null,
        category_id: formCategoryId || null,
        status: type === "unexpected" ? "paid" : "pending",
        due_date: type === "fixed" ? (formDueDate || getNextDueDate(null, formFrequency)) : (formDueDate || new Date().toISOString()),
        paid_at: type === "unexpected" ? new Date().toISOString() : null,
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
        if (type === "unexpected" && user) {
          await supabase.from("treasury_movements").insert({
            business_id: businessId,
            branch_id: branchId,
            amount: parseFloat(formAmount) || 0,
            movement_type: "expense",
            label: formDescription || "Gasto imprevisto",
            category_id: formCategoryId || null,
            reason: formDescription || null,
            registered_by: user.id,
            payment_method: "cash",
            cash_amount: parseFloat(formAmount) || 0,
            transfer_amount: 0,
          });
        }
      }
    },
    onSuccess: () => {
      toast.success(editingExpense ? "Gasto actualizado" : "Gasto registrado");
      qc.invalidateQueries({ queryKey: ["accounting-expenses"] });
      qc.invalidateQueries({ queryKey: ["treasury-movements"] });
      setFixedDialog(false);
      setUnexpectedDialog(false);
      resetForm();
    },
    onError: (err: any) => toast.error(err.message || "Error al guardar"),
  });

  const markPaidMutation = useMutation({
    mutationFn: async (expense: Expense) => {
      const now = new Date().toISOString();
      const nextDue = expense.frequency ? getNextDueDate(expense.due_date, expense.frequency) : null;

      // Update current expense to paid
      await supabase.from("accounting_expenses").update({ status: "paid", paid_at: now }).eq("id", expense.id);

      // Create treasury movement
      if (user) {
        await supabase.from("treasury_movements").insert({
          business_id: expense.business_id,
          branch_id: expense.branch_id,
          amount: expense.amount,
          movement_type: "expense",
          label: expense.name,
          category_id: expense.category_id,
          reason: `Pago de gasto fijo: ${expense.name}`,
          registered_by: user.id,
          payment_method: "cash",
          cash_amount: expense.amount,
          transfer_amount: 0,
        });
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
    onSuccess: () => {
      toast.success("Gasto marcado como pagado");
      qc.invalidateQueries({ queryKey: ["accounting-expenses"] });
      qc.invalidateQueries({ queryKey: ["treasury-movements"] });
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

  const openEditFixed = (e: Expense) => {
    setEditingExpense(e);
    setFormName(e.name);
    setFormAmount(String(e.amount));
    setFormFrequency(e.frequency || "monthly");
    setFormCategoryId(e.category_id || "");
    setFormDescription(e.description || "");
    setFormDueDate(e.due_date ? format(parseISO(e.due_date), "yyyy-MM-dd") : "");
    setFixedDialog(true);
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

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-3">Desglose por categoría</p>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* ── FIXED EXPENSES ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Gastos Fijos</h3>
          <Button size="sm" onClick={() => { resetForm(); setFixedDialog(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Agregar
          </Button>
        </div>
        <Card>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Frecuencia</TableHead>
                  <TableHead>Próximo venc.</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fixedExpenses.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin gastos fijos</TableCell></TableRow>
                ) : fixedExpenses.map((e) => (
                  <TableRow key={e.id} className={e.status === "overdue" ? "bg-destructive/5" : ""}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-right">${e.amount.toLocaleString()}</TableCell>
                    <TableCell>{freqLabel(e.frequency)}</TableCell>
                    <TableCell>{e.due_date ? format(parseISO(e.due_date), "dd MMM yyyy", { locale: es }) : "—"}</TableCell>
                    <TableCell>{statusBadge(e.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {e.status !== "paid" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => markPaidMutation.mutate(e)} title="Marcar pagado">
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditFixed(e)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteMutation.mutate(e.id)} title="Eliminar">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* ── UNEXPECTED EXPENSES ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Gastos Imprevistos</h3>
          <Button size="sm" onClick={() => { resetForm(); setUnexpectedDialog(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Agregar
          </Button>
        </div>
        <Card>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Comprobante</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unexpectedExpenses.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin gastos imprevistos</TableCell></TableRow>
                ) : unexpectedExpenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">{e.name}</TableCell>
                    <TableCell className="text-right">${e.amount.toLocaleString()}</TableCell>
                    <TableCell>{e.paid_at ? format(parseISO(e.paid_at), "dd MMM yyyy", { locale: es }) : "—"}</TableCell>
                    <TableCell>{getCategoryName(e.category_id)}</TableCell>
                    <TableCell>
                      {e.receipt_url ? (
                        <a href={e.receipt_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-xs">
                          <Receipt className="h-3.5 w-3.5" /> Ver
                        </a>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteMutation.mutate(e.id)} title="Eliminar">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* ── Fixed Expense Dialog ── */}
      <Dialog open={fixedDialog} onOpenChange={(o) => { if (!o) resetForm(); setFixedDialog(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Editar Gasto Fijo" : "Nuevo Gasto Fijo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ej: Internet" />
            </div>
            <div>
              <Label>Monto</Label>
              <Input type="number" min="0" step="0.01" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Frecuencia</Label>
              <Select value={formFrequency} onValueChange={setFormFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Próximo vencimiento</Label>
              <Input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} />
            </div>
            <div>
              <Label>Categoría (opcional)</Label>
              <Select value={formCategoryId} onValueChange={setFormCategoryId}>
                <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin categoría</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFixedDialog(false); resetForm(); }}>Cancelar</Button>
            <Button disabled={!formName || !formAmount || saveMutation.isPending} onClick={() => saveMutation.mutate("fixed")}>
              {saveMutation.isPending ? "Guardando..." : editingExpense ? "Actualizar" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Unexpected Expense Dialog ── */}
      <Dialog open={unexpectedDialog} onOpenChange={(o) => { if (!o) resetForm(); setUnexpectedDialog(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Gasto Imprevisto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Descripción</Label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Describe el gasto..." />
            </div>
            <div>
              <Label>Monto</Label>
              <Input type="number" min="0" step="0.01" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} />
            </div>
            <div>
              <Label>Categoría (opcional)</Label>
              <Select value={formCategoryId} onValueChange={setFormCategoryId}>
                <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin categoría</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Comprobante (opcional)</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-1" onClick={() => document.getElementById("receipt-input")?.click()}>
                  <Upload className="h-4 w-4" /> {formFile ? formFile.name : "Adjuntar archivo"}
                </Button>
                <input id="receipt-input" type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setFormFile(e.target.files?.[0] || null)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUnexpectedDialog(false); resetForm(); }}>Cancelar</Button>
            <Button disabled={!formAmount || saveMutation.isPending || uploading} onClick={() => saveMutation.mutate("unexpected")}>
              {uploading ? "Subiendo..." : saveMutation.isPending ? "Guardando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExpensesTab;
