import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useResolvedBusinessId } from "@/hooks/useResolvedBusinessId";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, ArrowRight, Droplets, TrendingDown, Calendar, BarChart3, Settings } from "lucide-react";
import { format, differenceInDays, subDays } from "date-fns";
import { es } from "date-fns/locale";
import PrinterManager from "./PrinterManager";

const COLORS = ["negro", "cian", "magenta", "amarillo"] as const;
type InkColor = (typeof COLORS)[number];

const COLOR_STYLES: Record<InkColor, string> = {
  negro: "bg-gray-900 dark:bg-gray-700",
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

  // Full multiplier config
  const { data: copyShopConfig } = useQuery({
    queryKey: ['copy-shop-config', businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('copy_shop_config')
        .select('*')
        .eq('business_id', businessId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
  });

  const updateFullMultiplier = useMutation({
    mutationFn: async (value: number) => {
      if (!businessId) throw new Error('Sin contexto');
      const { error } = await supabase
        .from('copy_shop_config')
        .update({ full_multiplier: value } as any)
        .eq('business_id', businessId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['copy-shop-config'] });
      toast.success("Multiplicador actualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [fullMultInput, setFullMultInput] = useState<string>('');

  // ——— Queries ———

  const { data: inventory = [] } = useQuery({
    queryKey: ["ink-inventory", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("print_ink_inventory")
        .select("*")
        .eq("business_id", businessId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!businessId,
  });

  const { data: usageRecords = [] } = useQuery({
    queryKey: ["ink-usage", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("print_ink_usage")
        .select("*")
        .eq("business_id", businessId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!businessId,
  });

  // ——— Stock aggregation ———

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
      if (r.ubicacion === "almacen") {
        map[c].almacen += Number(r.cantidad);
      } else {
        map[c].taller += Number(r.cantidad);
        map[c].tallerCost += Number(r.costo_total);
      }
      map[c].totalCost += Number(r.costo_total);
    });
    return map;
  }, [inventory]);

  // ——— Consumption aggregation ———

  const consumptionByColor = useMemo(() => {
    const map: Record<InkColor, { total: number; last30Days: number; entries: number }> = {
      negro: { total: 0, last30Days: 0, entries: 0 },
      cian: { total: 0, last30Days: 0, entries: 0 },
      magenta: { total: 0, last30Days: 0, entries: 0 },
      amarillo: { total: 0, last30Days: 0, entries: 0 },
    };
    const thirtyDaysAgo = subDays(new Date(), 30);
    usageRecords.forEach((r: any) => {
      const c = r.color as InkColor;
      if (!map[c]) return;
      const amount = Number(r.cantidad_consumida);
      map[c].total += amount;
      map[c].entries += 1;
      if (new Date(r.created_at) >= thirtyDaysAgo) {
        map[c].last30Days += amount;
      }
    });
    return map;
  }, [usageRecords]);

  // ——— Analysis metrics ———

  const analysisMetrics = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);

    // Get first usage date to calculate total active days
    const autoUsages = usageRecords.filter((r: any) => r.is_automatic);
    if (autoUsages.length === 0) return null;

    const firstUsageDate = new Date(autoUsages[autoUsages.length - 1]?.created_at || now);
    const totalDays = Math.max(1, differenceInDays(now, firstUsageDate));

    const colorMetrics = COLORS.map((color) => {
      const cons = consumptionByColor[color];
      const stock = stockByColor[color];

      // Daily average (last 30 days, or total if less data)
      const daysForAvg = Math.min(totalDays, 30);
      const dailyAvg = daysForAvg > 0 ? cons.last30Days / daysForAvg : cons.total / totalDays;

      // Remaining estimated value in taller (taller cost - consumed)
      const tallerValue = Math.max(0, stock.tallerCost - cons.total);

      // Projected days remaining
      const daysRemaining = dailyAvg > 0 ? Math.floor(tallerValue / dailyAvg) : null;

      // % the business separates for ink (totalCost as % of total inventory value)
      const totalInvValue = inventory
        .filter((r: any) => Number(r.costo_total) > 0)
        .reduce((s: number, r: any) => s + Number(r.costo_total), 0);
      const pctSeparated = totalInvValue > 0 ? (stock.totalCost / totalInvValue) * 100 : 0;

      // % real consumption
      const totalConsumption = Object.values(consumptionByColor).reduce((s, c) => s + c.total, 0);
      const pctRealConsumption = totalConsumption > 0 ? (cons.total / totalConsumption) * 100 : 0;

      return {
        color,
        dailyAvg,
        tallerValue,
        daysRemaining,
        pctSeparated,
        pctRealConsumption,
        totalConsumed: cons.total,
      };
    });

    return colorMetrics;
  }, [consumptionByColor, stockByColor, usageRecords, inventory]);

  // ——— Mutations ———

  const buyMutation = useMutation({
    mutationFn: async () => {
      const cant = Number(buyCantidad);
      const costo = Number(buyCosto);
      if (!cant || cant <= 0) throw new Error("Cantidad inválida");
      if (!costo || costo <= 0) throw new Error("Costo inválido");

      const { error } = await supabase.from("print_ink_inventory").insert({
        business_id: businessId!,
        color: buyColor,
        tipo: buyTipo,
        cantidad: cant,
        unidad: buyTipo === "cartucho" ? "unidad" : "ml",
        ubicacion: buyUbicacion,
        costo_total: costo,
        nota: buyNota || null,
        user_id: userId!,
      });
      if (error) throw error;

      await supabase.from("accounting_expenses").insert({
        business_id: businessId!,
        name: `Tinta ${COLOR_LABELS[buyColor]} (${buyTipo})`,
        amount: costo,
        expense_type: "unexpected",
        status: "paid",
        paid_at: new Date().toISOString(),
        description: buyNota || `Compra de tinta ${COLOR_LABELS[buyColor]}`,
        created_by: userId!,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ink-inventory"] });
      qc.invalidateQueries({ queryKey: ["bp-fixed-expenses"] });
      toast.success("Compra de tinta registrada");
      setBuyOpen(false);
      setBuyCantidad("");
      setBuyCosto("");
      setBuyNota("");
    },
    onError: (e: any) => toast.error(e.message || "Error al registrar compra"),
  });

  const moveMutation = useMutation({
    mutationFn: async () => {
      const cant = Number(moveCantidad);
      if (!cant || cant <= 0) throw new Error("Cantidad inválida");
      const available = stockByColor[moveColor].almacen;
      if (cant > available) throw new Error(`Solo hay ${available} en almacén`);

      const { error: e1 } = await supabase.from("print_ink_inventory").insert({
        business_id: businessId!,
        color: moveColor,
        tipo: "cartucho",
        cantidad: -cant,
        unidad: "unidad",
        ubicacion: "almacen",
        costo_total: 0,
        nota: "Transferencia al taller",
        user_id: userId!,
      });
      if (e1) throw e1;

      // Calculate proportional cost for the transfer
      const colorInv = inventory.filter((r: any) => r.color === moveColor && Number(r.costo_total) > 0);
      const totalCostColor = colorInv.reduce((s: number, r: any) => s + Number(r.costo_total), 0);
      const totalQtyColor = colorInv.reduce((s: number, r: any) => s + Math.abs(Number(r.cantidad)), 0);
      const costPerUnit = totalQtyColor > 0 ? totalCostColor / totalQtyColor : 0;

      const { error: e2 } = await supabase.from("print_ink_inventory").insert({
        business_id: businessId!,
        color: moveColor,
        tipo: "cartucho",
        cantidad: cant,
        unidad: "unidad",
        ubicacion: "taller",
        costo_total: costPerUnit * cant,
        nota: "Transferencia desde almacén",
        user_id: userId!,
      });
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ink-inventory"] });
      toast.success("Tinta movida al taller");
      setMoveOpen(false);
      setMoveCantidad("");
    },
    onError: (e: any) => toast.error(e.message || "Error al mover tinta"),
  });

  // Recent automatic usage entries
  const recentUsage = useMemo(() => {
    return usageRecords
      .filter((r: any) => r.is_automatic)
      .slice(0, 30);
  }, [usageRecords]);

  return (
    <div className="space-y-6">
      {/* ——— SECTION 1: Stock actual ——— */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Stock actual de tinta</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setMoveOpen(true)}>
              <ArrowRight className="h-3.5 w-3.5 mr-1" /> Mover al taller
            </Button>
            <Button size="sm" onClick={() => setBuyOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Nueva compra
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {COLORS.map((color) => {
            const s = stockByColor[color];
            const consumed = consumptionByColor[color].total;
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
      </div>

      {/* ——— SECTION 2: Análisis de rendimiento ——— */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <BarChart3 className="h-5 w-5" /> Análisis de rendimiento
        </h2>

        {!analysisMetrics ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              <Droplets className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Registra cobros en Impresiones para ver el análisis automático de consumo de tinta.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {/* Metrics table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Color</TableHead>
                        <TableHead className="text-right">Consumo diario</TableHead>
                        <TableHead className="text-right">Días restantes</TableHead>
                        <TableHead className="text-right">% Invertido</TableHead>
                        <TableHead className="text-right">% Consumo real</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysisMetrics.map((m) => (
                        <TableRow key={m.color}>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <div className={`h-3 w-3 rounded-full ${COLOR_STYLES[m.color as InkColor]}`} />
                              <span className="text-sm font-medium">{COLOR_LABELS[m.color as InkColor]}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {fmt(m.dailyAvg)}<span className="text-muted-foreground">/día</span>
                          </TableCell>
                          <TableCell className="text-right">
                            {m.daysRemaining !== null ? (
                              <span className={`text-sm font-medium ${m.daysRemaining <= 7 ? 'text-destructive' : m.daysRemaining <= 15 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
                                {m.daysRemaining} días
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {m.pctSeparated.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {m.pctRealConsumption.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* % Comparison cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {analysisMetrics.filter(m => m.pctSeparated > 0 || m.pctRealConsumption > 0).map((m) => {
                const diff = m.pctRealConsumption - m.pctSeparated;
                const isOver = diff > 2;
                const isUnder = diff < -2;
                return (
                  <Card key={m.color}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`h-3 w-3 rounded-full ${COLOR_STYLES[m.color as InkColor]}`} />
                        <span className="text-sm font-semibold">{COLOR_LABELS[m.color as InkColor]}</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Inversión</span>
                          <div className="flex items-center gap-1">
                            <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-primary/60" style={{ width: `${Math.min(100, m.pctSeparated)}%` }} />
                            </div>
                            <span>{m.pctSeparated.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Consumo real</span>
                          <div className="flex items-center gap-1">
                            <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                              <div className={`h-full rounded-full ${isOver ? 'bg-destructive' : 'bg-green-500'}`} style={{ width: `${Math.min(100, m.pctRealConsumption)}%` }} />
                            </div>
                            <span>{m.pctRealConsumption.toFixed(1)}%</span>
                          </div>
                        </div>
                        {(isOver || isUnder) && (
                          <p className={`text-xs mt-1 ${isOver ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>
                            {isOver ? `⚠ Consumo ${diff.toFixed(1)}% mayor a la inversión` : `✓ Consumo ${Math.abs(diff).toFixed(1)}% menor a la inversión`}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ——— SECTION 3: Historial de consumo automático ——— */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <TrendingDown className="h-5 w-5" /> Consumo automático reciente
        </h2>

        {recentUsage.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground text-sm">
              <Droplets className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>El consumo de tinta se registra automáticamente con cada cobro de impresión.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Consumo ($)</TableHead>
                      <TableHead className="text-right">Hojas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentUsage.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(r.created_at), "dd/MM/yy HH:mm", { locale: es })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <div className={`h-3 w-3 rounded-full ${COLOR_STYLES[r.color as InkColor] || "bg-gray-400"}`} />
                            <span className="text-sm">{COLOR_LABELS[r.color as InkColor] || r.color}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.nota || "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {fmt(Number(r.cantidad_consumida))}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {r.hojas_impresas}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ——— SECTION 4: Impresoras ——— */}
      <PrinterManager />

      {/* ——— SECTION 5: Configuración de consumo ——— */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Settings className="h-5 w-5" /> Configuración de consumo
        </h2>
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Multiplicador Full</p>
                <p className="text-xs text-muted-foreground">
                  Cuántas veces más tinta consume una impresión Full vs color normal
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  step="0.1"
                  className="w-20 h-8 text-sm text-right"
                  value={fullMultInput || (copyShopConfig as any)?.full_multiplier || '2.0'}
                  onChange={e => setFullMultInput(e.target.value)}
                  onBlur={() => {
                    const val = parseFloat(fullMultInput);
                    if (val && val >= 1) {
                      updateFullMultiplier.mutate(val);
                    }
                    setFullMultInput('');
                  }}
                />
                <span className="text-xs text-muted-foreground">×</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ——— MODAL: Nueva compra ——— */}
      <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva compra de tinta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Color</Label>
              <Select value={buyColor} onValueChange={(v) => setBuyColor(v as InkColor)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLORS.map((c) => (
                    <SelectItem key={c} value={c}>{COLOR_LABELS[c]}</SelectItem>
                  ))}
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
              <Input type="number" min="0" value={buyCantidad} onChange={(e) => setBuyCantidad(e.target.value)} placeholder="Ej: 1" />
            </div>
            <div>
              <Label>Costo total de la compra</Label>
              <Input type="number" min="0" step="0.01" value={buyCosto} onChange={(e) => setBuyCosto(e.target.value)} placeholder="$0.00" />
            </div>
            <div>
              <Label>Ubicación inicial</Label>
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
              <Textarea value={buyNota} onChange={(e) => setBuyNota(e.target.value)} rows={2} />
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

      {/* ——— MODAL: Mover al taller ——— */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mover tinta al taller</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Color</Label>
              <Select value={moveColor} onValueChange={(v) => setMoveColor(v as InkColor)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLORS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {COLOR_LABELS[c]} (almacén: {stockByColor[c].almacen})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cantidad a mover</Label>
              <Input type="number" min="1" max={stockByColor[moveColor].almacen} value={moveCantidad} onChange={(e) => setMoveCantidad(e.target.value)} />
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
    </div>
  );
}
