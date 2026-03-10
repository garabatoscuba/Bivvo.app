import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useResolvedBusinessId } from "@/hooks/useResolvedBusinessId";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePrintPrinters } from "@/hooks/usePrintPrinters";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, ArrowRight, Droplets, TrendingDown, BarChart3, Settings, Printer, ChevronLeft, AlertTriangle } from "lucide-react";
import { format, differenceInDays, subDays } from "date-fns";
import { es } from "date-fns/locale";
import PrinterManager from "./PrinterManager";

const COLORS = ["negro", "cian", "magenta", "amarillo"] as const;
type InkColor = (typeof COLORS)[number];

const COLOR_STYLES: Record<InkColor, string> = {
  negro: "bg-gray-900 dark:bg-gray-600",
  cian: "bg-cyan-500",
  magenta: "bg-pink-500",
  amarillo: "bg-yellow-400",
};

const COLOR_LABELS: Record<InkColor, string> = {
  negro: "Negro",
  cian: "Cian",
  magenta: "Magenta",
  amarillo: "Amarillo",
};

const fmt = (n: number) =>
  "$" + n.toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function TintaTab() {
  const { profile } = useAuth();
  const { businessId, branchId } = useResolvedBusinessId();
  const userId = profile?.user_id;
  const qc = useQueryClient();

  const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);

  // Buy form
  const [buyColor, setBuyColor] = useState<InkColor>("negro");
  const [buyTipo, setBuyTipo] = useState("cartucho");
  const [buyCantidad, setBuyCantidad] = useState("");
  const [buyCosto, setBuyCosto] = useState("");
  const [buyUbicacion, setBuyUbicacion] = useState("almacen");
  const [buyNota, setBuyNota] = useState("");

  // Move form
  const [moveColor, setMoveColor] = useState<InkColor>("negro");
  const [moveCantidad, setMoveCantidad] = useState("");

  // Full multiplier
  const { data: copyShopConfig } = useQuery({
    queryKey: ['copy-shop-config', businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('copy_shop_config').select('*').eq('business_id', businessId!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
  });

  const updateFullMultiplier = useMutation({
    mutationFn: async (value: number) => {
      if (!businessId) throw new Error('Sin contexto');
      const { error } = await supabase
        .from('copy_shop_config').update({ full_multiplier: value } as any).eq('business_id', businessId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['copy-shop-config'] }); toast.success("Multiplicador actualizado"); },
    onError: (e: any) => toast.error(e.message),
  });
  const [fullMultInput, setFullMultInput] = useState('');

  // Printers
  const { data: printers = [] } = usePrintPrinters();

  // Inventory & usage
  const { data: inventory = [] } = useQuery({
    queryKey: ["ink-inventory", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("print_ink_inventory").select("*").eq("business_id", businessId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!businessId,
  });

  const { data: usageRecords = [] } = useQuery({
    queryKey: ["ink-usage", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("print_ink_usage").select("*").eq("business_id", businessId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!businessId,
  });

  // Job items with printer_id for mapping usage→printer
  const { data: jobItems = [] } = useQuery({
    queryKey: ["print-job-items-map", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("print_job_items" as any).select("id, printer_id").eq("business_id", businessId!);
      // fallback: job_items may not have business_id, join via jobs
      if (error) {
        const { data: d2, error: e2 } = await supabase
          .from("print_job_items" as any).select("id, printer_id, job_id");
        if (e2) return [];
        return (d2 || []) as any[];
      }
      return (data || []) as any[];
    },
    enabled: !!businessId,
  });

  // Map job_item_id → printer_id
  const itemPrinterMap = useMemo(() => {
    const m: Record<string, string | null> = {};
    jobItems.forEach((ji: any) => { m[ji.id] = ji.printer_id || null; });
    return m;
  }, [jobItems]);

  // Stock aggregation (global)
  const stockByColor = useMemo(() => {
    const map: Record<InkColor, { almacen: number; taller: number; totalCost: number; tallerCost: number }> = {
      negro: { almacen: 0, taller: 0, totalCost: 0, tallerCost: 0 },
      cian: { almacen: 0, taller: 0, totalCost: 0, tallerCost: 0 },
      magenta: { almacen: 0, taller: 0, totalCost: 0, tallerCost: 0 },
      amarillo: { almacen: 0, taller: 0, totalCost: 0, tallerCost: 0 },
    };
    inventory.forEach((r: any) => {
      const c = r.color as InkColor;
      if (!map[c]) return;
      if (r.ubicacion === "almacen") map[c].almacen += Number(r.cantidad);
      else { map[c].taller += Number(r.cantidad); map[c].tallerCost += Number(r.costo_total); }
      map[c].totalCost += Number(r.costo_total);
    });
    return map;
  }, [inventory]);

  // Consumption helpers
  const getConsumptionByColor = (printerId?: string | null) => {
    const map: Record<InkColor, { total: number; last30Days: number; entries: number }> = {
      negro: { total: 0, last30Days: 0, entries: 0 },
      cian: { total: 0, last30Days: 0, entries: 0 },
      magenta: { total: 0, last30Days: 0, entries: 0 },
      amarillo: { total: 0, last30Days: 0, entries: 0 },
    };
    const thirtyDaysAgo = subDays(new Date(), 30);
    usageRecords.forEach((r: any) => {
      // Filter by printer if specified
      if (printerId) {
        const jiPrinter = r.job_item_id ? itemPrinterMap[r.job_item_id] : null;
        if (jiPrinter !== printerId) return;
      }
      const c = r.color as InkColor;
      if (!map[c]) return;
      const amount = Number(r.cantidad_consumida);
      map[c].total += amount;
      map[c].entries += 1;
      if (new Date(r.created_at) >= thirtyDaysAgo) map[c].last30Days += amount;
    });
    return map;
  };

  const globalConsumption = useMemo(() => getConsumptionByColor(), [usageRecords, itemPrinterMap]);

  // Per-printer consumption percentages for tank bars
  const printerTankData = useMemo(() => {
    return printers.map((p: any) => {
      const cons = getConsumptionByColor(p.id);
      const colors = (p.colores || ['negro']) as InkColor[];
      const tanks = colors.map(c => {
        const s = stockByColor[c];
        const tallerValue = Math.max(0, s.tallerCost);
        const consumed = cons[c]?.total || 0;
        const remaining = Math.max(0, tallerValue - consumed);
        const pct = tallerValue > 0 ? (remaining / tallerValue) * 100 : 0;
        return { color: c, pct, remaining, consumed, isLow: pct > 0 && pct < 20 };
      });
      const hasAlert = tanks.some(t => t.isLow);
      return { printer: p, tanks, hasAlert };
    });
  }, [printers, stockByColor, usageRecords, itemPrinterMap]);

  // Analysis for a given printer (or global)
  const getAnalysis = (printerId?: string | null) => {
    const consumption = getConsumptionByColor(printerId);
    const now = new Date();
    const autoUsages = usageRecords.filter((r: any) => {
      if (!r.is_automatic) return false;
      if (printerId) {
        const jiPrinter = r.job_item_id ? itemPrinterMap[r.job_item_id] : null;
        if (jiPrinter !== printerId) return false;
      }
      return true;
    });
    if (autoUsages.length === 0) return null;
    const firstDate = new Date(autoUsages[autoUsages.length - 1]?.created_at || now);
    const totalDays = Math.max(1, differenceInDays(now, firstDate));

    return COLORS.map(color => {
      const cons = consumption[color];
      const stock = stockByColor[color];
      const daysForAvg = Math.min(totalDays, 30);
      const dailyAvg = daysForAvg > 0 ? cons.last30Days / daysForAvg : cons.total / totalDays;
      const tallerValue = Math.max(0, stock.tallerCost - cons.total);
      const daysRemaining = dailyAvg > 0 ? Math.floor(tallerValue / dailyAvg) : null;
      const totalConsumption = Object.values(consumption).reduce((s, c) => s + c.total, 0);
      const pctRealConsumption = totalConsumption > 0 ? (cons.total / totalConsumption) * 100 : 0;
      return { color, dailyAvg, tallerValue, daysRemaining, pctRealConsumption, totalConsumed: cons.total };
    });
  };

  const getRecentUsage = (printerId?: string | null) => {
    return usageRecords
      .filter((r: any) => {
        if (!r.is_automatic) return false;
        if (printerId) {
          const jiPrinter = r.job_item_id ? itemPrinterMap[r.job_item_id] : null;
          if (jiPrinter !== printerId) return false;
        }
        return true;
      })
      .slice(0, 30);
  };

  // Mutations
  const buyMutation = useMutation({
    mutationFn: async () => {
      const cant = Number(buyCantidad);
      const costo = Number(buyCosto);
      if (!cant || cant <= 0) throw new Error("Cantidad inválida");
      if (!costo || costo <= 0) throw new Error("Costo inválido");
      const { error } = await supabase.from("print_ink_inventory").insert({
        business_id: businessId!, color: buyColor, tipo: buyTipo, cantidad: cant,
        unidad: buyTipo === "cartucho" ? "unidad" : "ml", ubicacion: buyUbicacion,
        costo_total: costo, nota: buyNota || null, user_id: userId!,
      });
      if (error) throw error;
      await supabase.from("accounting_expenses").insert({
        business_id: businessId!, name: `Tinta ${COLOR_LABELS[buyColor]} (${buyTipo})`,
        amount: costo, expense_type: "unexpected", status: "paid",
        paid_at: new Date().toISOString(), description: buyNota || `Compra de tinta ${COLOR_LABELS[buyColor]}`,
        created_by: userId!,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ink-inventory"] });
      toast.success("Compra de tinta registrada");
      setBuyOpen(false); setBuyCantidad(""); setBuyCosto(""); setBuyNota("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const moveMutation = useMutation({
    mutationFn: async () => {
      const cant = Number(moveCantidad);
      if (!cant || cant <= 0) throw new Error("Cantidad inválida");
      const available = stockByColor[moveColor].almacen;
      if (cant > available) throw new Error(`Solo hay ${available} en almacén`);
      const { error: e1 } = await supabase.from("print_ink_inventory").insert({
        business_id: businessId!, color: moveColor, tipo: "cartucho", cantidad: -cant,
        unidad: "unidad", ubicacion: "almacen", costo_total: 0, nota: "Transferencia al taller", user_id: userId!,
      });
      if (e1) throw e1;
      const colorInv = inventory.filter((r: any) => r.color === moveColor && Number(r.costo_total) > 0);
      const totalCostColor = colorInv.reduce((s: number, r: any) => s + Number(r.costo_total), 0);
      const totalQtyColor = colorInv.reduce((s: number, r: any) => s + Math.abs(Number(r.cantidad)), 0);
      const costPerUnit = totalQtyColor > 0 ? totalCostColor / totalQtyColor : 0;
      const { error: e2 } = await supabase.from("print_ink_inventory").insert({
        business_id: businessId!, color: moveColor, tipo: "cartucho", cantidad: cant,
        unidad: "unidad", ubicacion: "taller", costo_total: costPerUnit * cant, nota: "Transferencia desde almacén", user_id: userId!,
      });
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ink-inventory"] });
      toast.success("Tinta movida al taller"); setMoveOpen(false); setMoveCantidad("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const hasPrinters = printers.length > 0;
  const selectedPrinter = printers.find((p: any) => p.id === selectedPrinterId);

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════

  const renderGlobalButtons = () => (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={() => setMoveOpen(true)}>
        <ArrowRight className="h-3.5 w-3.5 mr-1" /> Mover al taller
      </Button>
      <Button size="sm" onClick={() => setBuyOpen(true)}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Nueva compra
      </Button>
    </div>
  );

  const renderStockCards = (filterColors?: InkColor[], printerId?: string | null) => {
    const colors = filterColors || COLORS;
    const consumption = getConsumptionByColor(printerId);
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {colors.map((color) => {
          const s = stockByColor[color];
          const consumed = consumption[color].total;
          const remaining = Math.max(0, s.tallerCost - consumed);
          return (
            <Card key={color}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`h-4 w-4 rounded-full ${COLOR_STYLES[color]}`} />
                  <span className="font-semibold text-sm">{COLOR_LABELS[color]}</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div className="rounded bg-muted/50 p-1.5 text-center">
                    <p className="font-bold text-base">{s.almacen}</p>
                    <p className="text-muted-foreground">Almacén</p>
                  </div>
                  <div className="rounded bg-muted/50 p-1.5 text-center">
                    <p className="font-bold text-base">{s.taller}</p>
                    <p className="text-muted-foreground">Taller</p>
                  </div>
                  <div className="rounded bg-muted/50 p-1.5 text-center">
                    <p className="font-bold text-sm text-destructive">{fmt(consumed)}</p>
                    <p className="text-muted-foreground">Consumido</p>
                  </div>
                  <div className="rounded bg-muted/50 p-1.5 text-center">
                    <p className={`font-bold text-sm ${remaining <= 0 ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>
                      {fmt(remaining)}
                    </p>
                    <p className="text-muted-foreground">Restante</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderAnalysis = (printerId?: string | null) => {
    const metrics = getAnalysis(printerId);
    if (!metrics) return (
      <Card><CardContent className="p-6 text-center text-muted-foreground">
        <Droplets className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Sin datos de consumo automático aún.</p>
      </CardContent></Card>
    );
    return (
      <Card><CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Color</TableHead>
                <TableHead className="text-right">Consumo/día</TableHead>
                <TableHead className="text-right">Días restantes</TableHead>
                <TableHead className="text-right">% Consumo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.map(m => (
                <TableRow key={m.color}>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <div className={`h-3 w-3 rounded-full ${COLOR_STYLES[m.color as InkColor]}`} />
                      <span className="text-sm font-medium">{COLOR_LABELS[m.color as InkColor]}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm">{fmt(m.dailyAvg)}<span className="text-muted-foreground">/día</span></TableCell>
                  <TableCell className="text-right">
                    {m.daysRemaining !== null ? (
                      <span className={`text-sm font-medium ${m.daysRemaining <= 7 ? 'text-destructive' : m.daysRemaining <= 15 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
                        {m.daysRemaining} días
                      </span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">{m.pctRealConsumption.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent></Card>
    );
  };

  const renderRecentUsage = (printerId?: string | null) => {
    const recent = getRecentUsage(printerId);
    if (recent.length === 0) return (
      <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">
        <Droplets className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>El consumo se registra automáticamente con cada cobro.</p>
      </CardContent></Card>
    );
    return (
      <Card><CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Consumo</TableHead>
                <TableHead className="text-right">Hojas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(r.created_at), "dd/MM/yy HH:mm", { locale: es })}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <div className={`h-3 w-3 rounded-full ${COLOR_STYLES[r.color as InkColor] || "bg-muted"}`} />
                      <span className="text-sm">{COLOR_LABELS[r.color as InkColor] || r.color}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.nota || "—"}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{fmt(Number(r.cantidad_consumida))}</TableCell>
                  <TableCell className="text-right text-sm">{r.hojas_impresas}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent></Card>
    );
  };

  // ═══════════════════════════════════════════
  // PRINTER DETAIL VIEW
  // ═══════════════════════════════════════════
  if (selectedPrinter) {
    const pColors = (selectedPrinter.colores || ['negro']) as InkColor[];
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedPrinterId(null)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Volver
          </Button>
          <div className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{selectedPrinter.name}</h2>
            {selectedPrinter.soporta_full && <Badge variant="outline" className="text-xs">Full</Badge>}
          </div>
        </div>

        {renderGlobalButtons()}

        <div>
          <h3 className="text-sm font-semibold mb-2">Stock por color</h3>
          {renderStockCards(pColors, selectedPrinter.id)}
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Análisis de rendimiento
          </h3>
          {renderAnalysis(selectedPrinter.id)}
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <TrendingDown className="h-4 w-4" /> Consumo automático reciente
          </h3>
          {renderRecentUsage(selectedPrinter.id)}
        </div>

        {renderModals()}
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // MAIN VIEW
  // ═══════════════════════════════════════════
  function renderModals() {
    return (
      <>
        {/* Nueva compra */}
        <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Nueva compra de tinta</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Color</Label>
                <Select value={buyColor} onValueChange={(v) => setBuyColor(v as InkColor)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COLORS.map(c => <SelectItem key={c} value={c}>{COLOR_LABELS[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={buyTipo} onValueChange={setBuyTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cartucho">Cartucho</SelectItem>
                    <SelectItem value="mililitros">Mililitros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cantidad</Label>
                <Input type="number" min="0" value={buyCantidad} onChange={e => setBuyCantidad(e.target.value)} placeholder="Ej: 1" />
              </div>
              <div>
                <Label>Costo total</Label>
                <Input type="number" min="0" step="0.01" value={buyCosto} onChange={e => setBuyCosto(e.target.value)} placeholder="$0.00" />
              </div>
              <div>
                <Label>Ubicación</Label>
                <Select value={buyUbicacion} onValueChange={setBuyUbicacion}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="almacen">Almacén</SelectItem>
                    <SelectItem value="taller">Taller</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nota (opcional)</Label>
                <Textarea value={buyNota} onChange={e => setBuyNota(e.target.value)} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBuyOpen(false)}>Cancelar</Button>
              <Button onClick={() => buyMutation.mutate()} disabled={buyMutation.isPending}>
                {buyMutation.isPending ? "Registrando..." : "Registrar compra"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Mover al taller */}
        <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Mover tinta al taller</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Color</Label>
                <Select value={moveColor} onValueChange={(v) => setMoveColor(v as InkColor)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COLORS.map(c => <SelectItem key={c} value={c}>{COLOR_LABELS[c]} (almacén: {stockByColor[c].almacen})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cantidad a mover</Label>
                <Input type="number" min="1" max={stockByColor[moveColor].almacen} value={moveCantidad} onChange={e => setMoveCantidad(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMoveOpen(false)}>Cancelar</Button>
              <Button onClick={() => moveMutation.mutate()} disabled={moveMutation.isPending}>
                {moveMutation.isPending ? "Moviendo..." : "Mover"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tinta</h2>
        {renderGlobalButtons()}
      </div>

      {/* Printer cards or fallback */}
      {hasPrinters ? (
        <div className="space-y-6">
          {/* Printer overview cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {printerTankData.map(({ printer, tanks, hasAlert }) => (
              <Card
                key={printer.id}
                className={`cursor-pointer transition-shadow hover:shadow-md ${!printer.is_active ? 'opacity-50' : ''}`}
                onClick={() => setSelectedPrinterId(printer.id)}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Printer className="h-5 w-5 text-muted-foreground" />
                      <span className="font-semibold text-sm">{printer.name}</span>
                    </div>
                    {hasAlert && (
                      <Badge variant="destructive" className="text-[10px] gap-1">
                        <AlertTriangle className="h-3 w-3" /> Bajo
                      </Badge>
                    )}
                    {printer.soporta_full && !hasAlert && (
                      <Badge variant="outline" className="text-[10px]">Full</Badge>
                    )}
                  </div>

                  {/* CMYK tank bars */}
                  <div className="space-y-1.5">
                    {tanks.map(t => (
                      <div key={t.color} className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded-full shrink-0 ${COLOR_STYLES[t.color]}`} />
                        <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              t.pct <= 15 ? 'bg-destructive' : t.pct <= 35 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, t.pct))}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground w-8 text-right shrink-0">
                          {t.pct > 0 ? `${Math.round(t.pct)}%` : '0%'}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Config sections below */}
          <PrinterManager />

          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Settings className="h-4 w-4" /> Configuración de consumo
            </h3>
            <Card><CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Multiplicador Full</p>
                  <p className="text-xs text-muted-foreground">Cuántas veces más tinta consume Full vs color normal</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number" min="1" step="0.1" className="w-20 h-8 text-sm text-right"
                    value={fullMultInput || (copyShopConfig as any)?.full_multiplier || '2.0'}
                    onChange={e => setFullMultInput(e.target.value)}
                    onBlur={() => {
                      const val = parseFloat(fullMultInput);
                      if (val && val >= 1) updateFullMultiplier.mutate(val);
                      setFullMultInput('');
                    }}
                  />
                  <span className="text-xs text-muted-foreground">×</span>
                </div>
              </div>
            </CardContent></Card>
          </div>
        </div>
      ) : (
        /* FALLBACK: No printers — show original global view */
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold mb-2">Stock actual de tinta</h3>
            {renderStockCards()}
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Análisis de rendimiento
            </h3>
            {renderAnalysis()}
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <TrendingDown className="h-4 w-4" /> Consumo automático reciente
            </h3>
            {renderRecentUsage()}
          </div>

          <PrinterManager />

          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Settings className="h-4 w-4" /> Configuración de consumo
            </h3>
            <Card><CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Multiplicador Full</p>
                  <p className="text-xs text-muted-foreground">Cuántas veces más tinta consume Full vs color normal</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number" min="1" step="0.1" className="w-20 h-8 text-sm text-right"
                    value={fullMultInput || (copyShopConfig as any)?.full_multiplier || '2.0'}
                    onChange={e => setFullMultInput(e.target.value)}
                    onBlur={() => {
                      const val = parseFloat(fullMultInput);
                      if (val && val >= 1) updateFullMultiplier.mutate(val);
                      setFullMultInput('');
                    }}
                  />
                  <span className="text-xs text-muted-foreground">×</span>
                </div>
              </div>
            </CardContent></Card>
          </div>
        </div>
      )}

      {renderModals()}
    </div>
  );
}
