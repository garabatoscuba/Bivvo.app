
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Plus, QrCode, Download, Calendar } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import { calcDepreciation, type Asset } from "./AssetsTab";

/* ───── labels ───── */
const CLASS_LABELS: Record<string, string> = {
  property: "Inmueble", machinery: "Maquinaria y Equipo", furniture: "Mobiliario", tools: "Herramientas",
};
const CONDITION_LABELS: Record<string, string> = {
  in_use: "En Uso", deprecated: "Depreciado", stored: "Almacenado",
};
const STATE_LABELS: Record<string, string> = {
  good: "Bueno", regular: "Regular", bad: "Malo",
};
const DEP_LABELS: Record<string, string> = {
  straight_line: "Línea Recta", declining_balance: "Saldo Decreciente",
};

interface Intervention {
  id: string;
  asset_id: string;
  intervention_date: string;
  description: string;
  cost: number;
  intervention_type: string;
  responsible: string | null;
  created_at: string;
}

interface Maintenance {
  id: string;
  asset_id: string;
  scheduled_date: string;
  description: string;
  is_completed: boolean;
  created_at: string;
}

/* ───── amortization helper ───── */
function buildAmortizationTable(asset: Asset) {
  const { adjusted_cost, residual_value = 0, useful_life_months, depreciation_method, acquisition_date } = asset;
  const resVal = residual_value ?? 0;
  if (!useful_life_months || !acquisition_date) return [];

  const start = new Date(acquisition_date);
  const totalYears = Math.ceil(useful_life_months / 12);
  const rows: { year: number; label: string; depreciation: number; bookValue: number }[] = [];

  let bv = adjusted_cost;
  const rate = depreciation_method === "declining_balance" ? 2 / useful_life_months : 0;
  const monthlyLinear = (adjusted_cost - resVal) / useful_life_months;
  let monthsProcessed = 0;

  for (let y = 0; y < totalYears; y++) {
    const yearLabel = `${start.getFullYear() + y}`;
    const monthsThisYear = Math.min(12, useful_life_months - monthsProcessed);
    let yearDep = 0;

    for (let m = 0; m < monthsThisYear; m++) {
      if (bv <= resVal) break;
      let dep: number;
      if (depreciation_method === "declining_balance") {
        dep = bv * rate;
        if (bv - dep < resVal) dep = bv - resVal;
      } else {
        dep = monthlyLinear;
        if (bv - dep < resVal) dep = bv - resVal;
      }
      yearDep += dep;
      bv -= dep;
    }
    monthsProcessed += monthsThisYear;
    rows.push({ year: y + 1, label: yearLabel, depreciation: yearDep, bookValue: bv });
    if (bv <= resVal) break;
  }
  return rows;
}

const fmt = (n: number) => n.toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ───── component ───── */
interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  asset: Asset;
  businessId: string;
}

export default function AssetDetailSheet({ open, onOpenChange, asset, businessId }: Props) {
  const qc = useQueryClient();
  const dep = calcDepreciation(asset);
  const amortization = buildAmortizationTable(asset);

  const [showQR, setShowQR] = useState(false);
  const [intOpen, setIntOpen] = useState(false);
  const [maintOpen, setMaintOpen] = useState(false);

  /* intervention form */
  const [intDate, setIntDate] = useState(new Date().toISOString().slice(0, 10));
  const [intDesc, setIntDesc] = useState("");
  const [intCost, setIntCost] = useState("");
  const [intType, setIntType] = useState("expense");
  const [intResp, setIntResp] = useState("");

  /* maintenance form */
  const [maintDate, setMaintDate] = useState("");
  const [maintDesc, setMaintDesc] = useState("");

  /* fetch interventions */
  const { data: interventions = [] } = useQuery({
    queryKey: ["asset-interventions", asset.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_asset_interventions")
        .select("*")
        .eq("asset_id", asset.id)
        .order("intervention_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Intervention[];
    },
  });

  /* fetch maintenances */
  const { data: maintenances = [] } = useQuery({
    queryKey: ["asset-maintenances", asset.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_asset_maintenances" as any)
        .select("*")
        .eq("asset_id", asset.id)
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Maintenance[];
    },
  });

  /* save intervention */
  const intMut = useMutation({
    mutationFn: async () => {
      const cost = parseFloat(intCost) || 0;
      const { error } = await supabase.from("accounting_asset_interventions").insert({
        asset_id: asset.id,
        intervention_date: intDate,
        description: intDesc,
        cost,
        intervention_type: intType,
        responsible: intResp || null,
      });
      if (error) throw error;

      // If improvement, update adjusted_cost
      if (intType === "improvement") {
        const newAdjusted = asset.adjusted_cost + cost;
        const { error: e2 } = await supabase
          .from("accounting_assets")
          .update({ adjusted_cost: newAdjusted })
          .eq("id", asset.id);
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      toast.success("Intervención registrada");
      qc.invalidateQueries({ queryKey: ["asset-interventions", asset.id] });
      qc.invalidateQueries({ queryKey: ["accounting-assets"] });
      setIntOpen(false);
      setIntDesc("");
      setIntCost("");
      setIntResp("");
    },
    onError: () => toast.error("Error al registrar"),
  });

  /* save maintenance */
  const maintMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("accounting_asset_maintenances" as any).insert({
        asset_id: asset.id,
        scheduled_date: maintDate,
        description: maintDesc,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mantenimiento programado");
      qc.invalidateQueries({ queryKey: ["asset-maintenances", asset.id] });
      setMaintOpen(false);
      setMaintDate("");
      setMaintDesc("");
    },
    onError: () => toast.error("Error al guardar"),
  });

  const downloadQR = () => {
    const canvas = document.getElementById("asset-qr-canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `activo-${asset.code || asset.id}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const qrUrl = `https://bivoo.app/activo/${asset.id}`;
  const upcomingMaint = maintenances.filter((m) => !m.is_completed && new Date(m.scheduled_date) >= new Date());

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-4 sm:p-6">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-lg">{asset.description}</SheetTitle>
          </SheetHeader>

          {/* ── Info cards ── */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <Card><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">Costo Original</p>
              <p className="text-sm font-bold">${fmt(asset.acquisition_cost)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">Costo Ajustado</p>
              <p className="text-sm font-bold">${fmt(asset.adjusted_cost)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">Valor en Libros</p>
              <p className="text-sm font-bold">${fmt(dep.bookValue)}</p>
            </CardContent></Card>
          </div>

          {/* Life progress */}
          {asset.useful_life_months && (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Vida útil consumida</span>
                <span>{Math.round(dep.lifePercent)}%</span>
              </div>
              <Progress value={dep.lifePercent} className="h-2" />
            </div>
          )}

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-4 border rounded-md p-3">
            <div><span className="text-muted-foreground">Código:</span> {asset.code ?? "—"}</div>
            <div><span className="text-muted-foreground">Clase:</span> {CLASS_LABELS[asset.asset_class]}</div>
            <div><span className="text-muted-foreground">Adquisición:</span> {asset.acquisition_date ?? "—"}</div>
            <div><span className="text-muted-foreground">Proveedor:</span> {asset.supplier ?? "—"}</div>
            <div><span className="text-muted-foreground">Ubicación:</span> {asset.location ?? "—"}</div>
            <div><span className="text-muted-foreground">Responsable:</span> {asset.responsible ?? "—"}</div>
            <div><span className="text-muted-foreground">Depreciación:</span> {DEP_LABELS[asset.depreciation_method ?? ""] ?? "—"}</div>
            <div><span className="text-muted-foreground">Vida útil:</span> {asset.useful_life_months ? `${asset.useful_life_months} meses` : "—"}</div>
            <div><span className="text-muted-foreground">Valor residual:</span> ${fmt(asset.residual_value ?? 0)}</div>
            <div><span className="text-muted-foreground">Cantidad:</span> {asset.quantity}</div>
            <div>
              <span className="text-muted-foreground">Condición:</span>{" "}
              <Badge variant="secondary" className="text-[10px] ml-1">{CONDITION_LABELS[asset.condition]}</Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Estado:</span>{" "}
              <Badge variant={asset.state === "bad" ? "destructive" : "secondary"} className="text-[10px] ml-1">
                {STATE_LABELS[asset.state]}
              </Badge>
            </div>
            {asset.observations && (
              <div className="col-span-2"><span className="text-muted-foreground">Observaciones:</span> {asset.observations}</div>
            )}
          </div>

          {/* QR button */}
          <div className="flex gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={() => setShowQR(!showQR)}>
              <QrCode className="h-3.5 w-3.5 mr-1" /> {showQR ? "Ocultar QR" : "Ver QR"}
            </Button>
          </div>

          {showQR && (
            <div className="flex flex-col items-center gap-2 mb-4 p-4 border rounded-md">
              <QRCodeCanvas id="asset-qr-canvas" value={qrUrl} size={180} />
              <p className="text-[10px] text-muted-foreground break-all">{qrUrl}</p>
              <Button variant="outline" size="sm" onClick={downloadQR}>
                <Download className="h-3.5 w-3.5 mr-1" /> Descargar QR
              </Button>
            </div>
          )}

          {/* ── Amortization table ── */}
          {amortization.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium mb-2">Tabla de Amortización</p>
              <div className="rounded-md border overflow-auto max-h-[200px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Año</TableHead>
                      <TableHead className="text-xs text-right">Dep. del Período</TableHead>
                      <TableHead className="text-xs text-right">Valor en Libros</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {amortization.map((r) => (
                      <TableRow key={r.year}>
                        <TableCell className="text-xs">{r.label}</TableCell>
                        <TableCell className="text-xs text-right">${fmt(r.depreciation)}</TableCell>
                        <TableCell className="text-xs text-right">${fmt(r.bookValue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* ── Interventions ── */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Historial de Intervenciones</p>
              <Button size="sm" variant="outline" onClick={() => setIntOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Registrar
              </Button>
            </div>
            {interventions.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin intervenciones registradas.</p>
            ) : (
              <div className="rounded-md border overflow-auto max-h-[200px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Fecha</TableHead>
                      <TableHead className="text-xs">Descripción</TableHead>
                      <TableHead className="text-xs text-right">Costo</TableHead>
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs">Responsable</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {interventions.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="text-xs">{i.intervention_date}</TableCell>
                        <TableCell className="text-xs max-w-[120px] truncate">{i.description}</TableCell>
                        <TableCell className="text-xs text-right">${fmt(i.cost)}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant={i.intervention_type === "improvement" ? "default" : "secondary"} className="text-[10px]">
                            {i.intervention_type === "improvement" ? "Mejora" : "Gasto"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{i.responsible ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* ── Maintenance calendar ── */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Mantenimientos Programados</p>
              <Button size="sm" variant="outline" onClick={() => setMaintOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Programar
              </Button>
            </div>
            {upcomingMaint.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin mantenimientos programados.</p>
            ) : (
              <div className="space-y-2">
                {upcomingMaint.map((m) => (
                  <div key={m.id} className="flex items-start gap-2 p-2 border rounded-md text-xs">
                    <Calendar className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="font-medium">{m.scheduled_date}</p>
                      <p className="text-muted-foreground">{m.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Intervention dialog */}
      <Dialog open={intOpen} onOpenChange={setIntOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Registrar Intervención</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={intDate} onChange={(e) => setIntDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Descripción *</Label>
              <Textarea value={intDesc} onChange={(e) => setIntDesc(e.target.value)} rows={2} />
            </div>
            <div>
              <Label className="text-xs">Costo</Label>
              <Input type="number" min="0" step="0.01" value={intCost} onChange={(e) => setIntCost(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={intType} onValueChange={setIntType}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Gasto</SelectItem>
                  <SelectItem value="improvement">Mejora</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Responsable</Label>
              <Input value={intResp} onChange={(e) => setIntResp(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIntOpen(false)}>Cancelar</Button>
            <Button onClick={() => intMut.mutate()} disabled={!intDesc || intMut.isPending}>
              {intMut.isPending ? "Guardando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Maintenance dialog */}
      <Dialog open={maintOpen} onOpenChange={setMaintOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Programar Mantenimiento</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label className="text-xs">Fecha programada *</Label>
              <Input type="date" value={maintDate} onChange={(e) => setMaintDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Descripción *</Label>
              <Textarea value={maintDesc} onChange={(e) => setMaintDesc(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaintOpen(false)}>Cancelar</Button>
            <Button onClick={() => maintMut.mutate()} disabled={!maintDate || !maintDesc || maintMut.isPending}>
              {maintMut.isPending ? "Guardando…" : "Programar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
