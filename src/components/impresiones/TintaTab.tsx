import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
import { Plus, ArrowRight, Droplets, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

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
  const businessId = profile?.business_id;
  const userId = profile?.user_id;
  const qc = useQueryClient();

  const [buyOpen, setBuyOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);

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

  // Usage form
  const [usageColor, setUsageColor] = useState<InkColor>("negro");
  const [usageCantidad, setUsageCantidad] = useState("");
  const [usageInicio, setUsageInicio] = useState("");
  const [usageFin, setUsageFin] = useState("");
  const [usageNota, setUsageNota] = useState("");

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
    const map: Record<InkColor, { almacen: number; taller: number; totalCost: number }> = {
      negro: { almacen: 0, taller: 0, totalCost: 0 },
      cian: { almacen: 0, taller: 0, totalCost: 0 },
      magenta: { almacen: 0, taller: 0, totalCost: 0 },
      amarillo: { almacen: 0, taller: 0, totalCost: 0 },
    };
    inventory.forEach((r: any) => {
      const c = r.color as InkColor;
      if (!map[c]) return;
      if (r.ubicacion === "almacen") map[c].almacen += Number(r.cantidad);
      else map[c].taller += Number(r.cantidad);
      map[c].totalCost += Number(r.costo_total);
    });
    return map;
  }, [inventory]);

  // ——— Mutations ———

  const buyMutation = useMutation({
    mutationFn: async () => {
      const cant = Number(buyCantidad);
      const costo = Number(buyCosto);
      if (!cant || cant <= 0) throw new Error("Cantidad inválida");
      if (!costo || costo <= 0) throw new Error("Costo inválido");

      // Insert ink inventory
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

      // Auto-create accounting expense
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

      // Remove from almacen
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

      // Add to taller
      const { error: e2 } = await supabase.from("print_ink_inventory").insert({
        business_id: businessId!,
        color: moveColor,
        tipo: "cartucho",
        cantidad: cant,
        unidad: "unidad",
        ubicacion: "taller",
        costo_total: 0,
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

  const usageMutation = useMutation({
    mutationFn: async () => {
      const cant = Number(usageCantidad);
      if (!cant || cant <= 0) throw new Error("Cantidad inválida");
      if (!usageInicio || !usageFin) throw new Error("Selecciona período");

      // Count sheets printed in period from print_job_items
      const { data: jobs } = await supabase
        .from("print_jobs")
        .select("id")
        .eq("business_id", businessId!)
        .gte("created_at", usageInicio)
        .lte("created_at", usageFin + "T23:59:59");

      let hojas = 0;
      if (jobs?.length) {
        const jobIds = jobs.map((j: any) => j.id);
        for (let i = 0; i < jobIds.length; i += 50) {
          const chunk = jobIds.slice(i, i + 50);
          const { data: items } = await supabase
            .from("print_job_items")
            .select("cantidad")
            .in("job_id", chunk);
          hojas += (items || []).reduce((s: number, it: any) => s + Number(it.cantidad || 0), 0);
        }
      }

      // Get average cost for this color
      const colorInv = inventory.filter((r: any) => r.color === usageColor && Number(r.costo_total) > 0);
      const totalCostColor = colorInv.reduce((s: number, r: any) => s + Number(r.costo_total), 0);
      const totalQtyColor = colorInv.reduce((s: number, r: any) => s + Number(r.cantidad), 0);
      const costPerUnit = totalQtyColor > 0 ? totalCostColor / totalQtyColor : 0;
      const costThisUsage = costPerUnit * cant;
      const costPerSheet = hojas > 0 ? costThisUsage / hojas : 0;

      // Register usage
      const { error } = await supabase.from("print_ink_usage").insert({
        business_id: businessId!,
        color: usageColor,
        cantidad_consumida: cant,
        periodo_inicio: usageInicio,
        periodo_fin: usageFin,
        hojas_impresas: hojas,
        costo_por_hoja: Math.round(costPerSheet * 10000) / 10000,
        nota: usageNota || null,
        user_id: userId!,
      });
      if (error) throw error;

      // Reduce taller stock
      await supabase.from("print_ink_inventory").insert({
        business_id: businessId!,
        color: usageColor,
        tipo: "cartucho",
        cantidad: -cant,
        unidad: "unidad",
        ubicacion: "taller",
        costo_total: 0,
        nota: `Bajada: ${cant} unidades, ${hojas} hojas`,
        user_id: userId!,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ink-inventory"] });
      qc.invalidateQueries({ queryKey: ["ink-usage"] });
      toast.success("Consumo de tinta registrado");
      setUsageOpen(false);
      setUsageCantidad("");
      setUsageInicio("");
      setUsageFin("");
      setUsageNota("");
    },
    onError: (e: any) => toast.error(e.message || "Error al registrar consumo"),
  });

  // ——— Analysis data ———

  const analysisData = useMemo(() => {
    return usageRecords.map((r: any) => ({
      periodo: `${format(new Date(r.periodo_inicio), "dd/MM", { locale: es })} - ${format(new Date(r.periodo_fin), "dd/MM", { locale: es })}`,
      color: r.color,
      consumida: Number(r.cantidad_consumida),
      hojas: r.hojas_impresas,
      costoPorHoja: Number(r.costo_por_hoja),
      fecha: new Date(r.periodo_fin).getTime(),
    }));
  }, [usageRecords]);

  const chartData = useMemo(() => {
    return [...analysisData]
      .sort((a, b) => a.fecha - b.fecha)
      .map((d) => ({
        name: d.periodo,
        costo: d.costoPorHoja,
      }));
  }, [analysisData]);

  // Historical average cost per sheet
  const avgCostPerSheet = useMemo(() => {
    const valid = analysisData.filter((d) => d.costoPorHoja > 0);
    if (!valid.length) return 0;
    return valid.reduce((s, d) => s + d.costoPorHoja, 0) / valid.length;
  }, [analysisData]);

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
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ——— SECTION 2: Registrar bajada ——— */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Registrar bajada de tinta</h2>
          <Button size="sm" variant="outline" onClick={() => setUsageOpen(true)}>
            <TrendingDown className="h-3.5 w-3.5 mr-1" /> Registrar consumo
          </Button>
        </div>

        {usageRecords.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              <Droplets className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No hay registros de consumo de tinta aún.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Color</TableHead>
                      <TableHead>Consumida</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-right">Hojas</TableHead>
                      <TableHead className="text-right">$/hoja</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usageRecords.slice(0, 20).map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <div className={`h-3 w-3 rounded-full ${COLOR_STYLES[r.color as InkColor] || "bg-gray-400"}`} />
                            <span className="text-sm">{COLOR_LABELS[r.color as InkColor] || r.color}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{r.cantidad_consumida}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(r.periodo_inicio), "dd/MM/yy")} – {format(new Date(r.periodo_fin), "dd/MM/yy")}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">{r.hojas_impresas.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{fmt(Number(r.costo_por_hoja))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ——— SECTION 3: Análisis de rendimiento ——— */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Análisis de rendimiento</h2>

        {avgCostPerSheet > 0 && (
          <Card className="mb-3">
            <CardContent className="p-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Costo promedio histórico por hoja</span>
              <span className="text-lg font-bold">{fmt(avgCostPerSheet)}</span>
            </CardContent>
          </Card>
        )}

        {chartData.length > 1 ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Tendencia costo por hoja</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <RechartsTooltip
                    formatter={(value: number) => [fmt(value), "$/hoja"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="costo"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground text-sm">
              Registra al menos 2 bajadas de tinta para ver la tendencia.
            </CardContent>
          </Card>
        )}
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

      {/* ——— MODAL: Registrar consumo ——— */}
      <Dialog open={usageOpen} onOpenChange={setUsageOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar consumo de tinta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Color</Label>
              <Select value={usageColor} onValueChange={(v) => setUsageColor(v as InkColor)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLORS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {COLOR_LABELS[c]} (taller: {stockByColor[c].taller})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cantidad consumida</Label>
              <Input type="number" min="1" value={usageCantidad} onChange={(e) => setUsageCantidad(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Fecha inicio</Label>
                <Input type="date" value={usageInicio} onChange={(e) => setUsageInicio(e.target.value)} />
              </div>
              <div>
                <Label>Fecha fin</Label>
                <Input type="date" value={usageFin} onChange={(e) => setUsageFin(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Nota (opcional)</Label>
              <Textarea value={usageNota} onChange={(e) => setUsageNota(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUsageOpen(false)}>Cancelar</Button>
            <Button onClick={() => usageMutation.mutate()} disabled={usageMutation.isPending}>
              {usageMutation.isPending ? "Registrando..." : "Registrar consumo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
