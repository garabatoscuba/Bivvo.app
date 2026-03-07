
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Eye, Pencil, Trash2, AlertTriangle, Building2, Wrench, Armchair, Hammer } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { toast } from "sonner";
import AssetFormDialog from "./AssetFormDialog";
import AssetDetailSheet from "./AssetDetailSheet";

/* ───── types ───── */
export interface Asset {
  id: string;
  business_id: string;
  branch_id: string | null;
  code: string | null;
  description: string;
  acquisition_date: string | null;
  supplier: string | null;
  acquisition_cost: number;
  adjusted_cost: number;
  asset_class: string;
  location: string | null;
  responsible: string | null;
  depreciation_method: string | null;
  useful_life_months: number | null;
  residual_value: number | null;
  quantity: number;
  condition: string;
  state: string;
  retirement_date: string | null;
  observations: string | null;
  created_at: string;
}

/* ───── depreciation helpers (exported for detail view) ───── */
export function calcDepreciation(asset: Asset) {
  const {
    adjusted_cost,
    residual_value = 0,
    useful_life_months,
    depreciation_method,
    acquisition_date,
  } = asset;

  const resVal = residual_value ?? 0;
  if (!useful_life_months || useful_life_months <= 0 || !acquisition_date) {
    return { accumulated: 0, bookValue: adjusted_cost, monthsElapsed: 0, lifePercent: 0 };
  }

  const start = new Date(acquisition_date);
  const now = new Date();
  let monthsElapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (monthsElapsed < 0) monthsElapsed = 0;

  let accumulated = 0;

  if (depreciation_method === "declining_balance") {
    let bv = adjusted_cost;
    const rate = 2 / useful_life_months;
    const months = Math.min(monthsElapsed, useful_life_months);
    for (let i = 0; i < months; i++) {
      const dep = bv * rate;
      if (bv - dep < resVal) {
        accumulated += bv - resVal;
        bv = resVal;
        break;
      }
      accumulated += dep;
      bv -= dep;
    }
  } else {
    // straight_line
    const monthlyDep = (adjusted_cost - resVal) / useful_life_months;
    const months = Math.min(monthsElapsed, useful_life_months);
    accumulated = monthlyDep * months;
  }

  const maxDep = adjusted_cost - resVal;
  if (accumulated > maxDep) accumulated = maxDep;
  const bookValue = adjusted_cost - accumulated;

  const lifePercent = Math.min((monthsElapsed / useful_life_months) * 100, 100);

  return { accumulated, bookValue, monthsElapsed, lifePercent };
}

/* ───── constants ───── */
const CLASS_LABELS: Record<string, string> = {
  property: "Inmueble",
  machinery: "Maquinaria y Equipo",
  furniture: "Mobiliario",
  tools: "Herramientas",
};

const CONDITION_LABELS: Record<string, string> = {
  in_use: "En Uso",
  deprecated: "Depreciado",
  stored: "Almacenado",
};

const STATE_LABELS: Record<string, string> = {
  good: "Bueno",
  regular: "Regular",
  bad: "Malo",
};

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

const CLASS_ICONS: Record<string, React.ReactNode> = {
  property: <Building2 className="h-4 w-4" />,
  machinery: <Wrench className="h-4 w-4" />,
  furniture: <Armchair className="h-4 w-4" />,
  tools: <Hammer className="h-4 w-4" />,
};

/* ───── component ───── */
interface Props {
  businessId: string;
  branchId: string | null;
}

export default function AssetsTab({ businessId, branchId }: Props) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [detailAsset, setDetailAsset] = useState<Asset | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterClass, setFilterClass] = useState("all");
  const [filterCondition, setFilterCondition] = useState("all");

  /* ── fetch ── */
  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["accounting-assets", businessId, branchId],
    queryFn: async () => {
      let q = supabase
        .from("accounting_assets")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Asset[];
    },
  });

  /* ── delete ── */
  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("accounting_assets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Activo eliminado");
      qc.invalidateQueries({ queryKey: ["accounting-assets"] });
      setDeleteId(null);
    },
    onError: () => toast.error("Error al eliminar"),
  });

  /* ── computed ── */
  const filtered = useMemo(() => {
    let list = assets;
    if (filterClass !== "all") list = list.filter((a) => a.asset_class === filterClass);
    if (filterCondition !== "all") list = list.filter((a) => a.condition === filterCondition);
    return list;
  }, [assets, filterClass, filterCondition]);

  const stats = useMemo(() => {
    let totalAcq = 0;
    let totalDep = 0;
    let totalBook = 0;
    for (const a of assets) {
      const d = calcDepreciation(a);
      totalAcq += a.acquisition_cost * a.quantity;
      totalDep += d.accumulated * a.quantity;
      totalBook += d.bookValue * a.quantity;
    }
    return { totalAcq, totalDep, totalBook, count: assets.length };
  }, [assets]);

  const pieData = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of assets) {
      const label = CLASS_LABELS[a.asset_class] || a.asset_class;
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [assets]);

  const alertCount = useMemo(
    () => assets.filter((a) => a.state === "bad" || a.condition === "deprecated").length,
    [assets],
  );

  const fmt = (n: number) =>
    n.toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* ── handlers ── */
  const openEdit = (a: Asset) => {
    setEditingAsset(a);
    setFormOpen(true);
  };
  const openAdd = () => {
    setEditingAsset(null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Alert banner */}
      {alertCount > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {alertCount} activo{alertCount > 1 ? "s" : ""} requiere{alertCount > 1 ? "n" : ""} atención (estado malo o depreciado).
          </AlertDescription>
        </Alert>
      )}

      {/* Dashboard cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          { label: "Valor Adquisición", value: stats.totalAcq },
          { label: "Dep. Acumulada", value: stats.totalDep },
          { label: "Valor en Libros", value: stats.totalBook },
          { label: "Total Activos", value: stats.count, isCurrency: false },
        ] as const).map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-lg font-bold mt-1">
                {"isCurrency" in c && c.isCurrency === false ? c.value : `$${fmt(c.value as number)}`}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Donut chart */}
      {pieData.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-2">Activos por Clasificación</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', padding: '8px' }} labelStyle={{ color: '#fff' }} itemStyle={{ color: '#fff' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Filters + add button */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-[160px] h-9 text-xs">
            <SelectValue placeholder="Clase" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las clases</SelectItem>
            {Object.entries(CLASS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterCondition} onValueChange={setFilterCondition}>
          <SelectTrigger className="w-[160px] h-9 text-xs">
            <SelectValue placeholder="Condición" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {Object.entries(CONDITION_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1" /> Agregar Activo
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Cargando…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No hay activos registrados.</p>
      ) : (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Código</TableHead>
                <TableHead className="text-xs">Descripción</TableHead>
                <TableHead className="text-xs">Clase</TableHead>
                <TableHead className="text-xs text-right">Costo Original</TableHead>
                <TableHead className="text-xs text-right">Valor en Libros</TableHead>
                <TableHead className="text-xs">Condición</TableHead>
                <TableHead className="text-xs">Estado</TableHead>
                <TableHead className="text-xs text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => {
                const dep = calcDepreciation(a);
                return (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs font-mono">{a.code ?? "—"}</TableCell>
                    <TableCell className="text-xs max-w-[180px] truncate">{a.description}</TableCell>
                    <TableCell className="text-xs">
                      <span className="flex items-center gap-1">
                        {CLASS_ICONS[a.asset_class]}
                        {CLASS_LABELS[a.asset_class] ?? a.asset_class}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-right">${fmt(a.acquisition_cost)}</TableCell>
                    <TableCell className="text-xs text-right">${fmt(dep.bookValue)}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant={a.condition === "deprecated" ? "destructive" : "secondary"} className="text-[10px]">
                        {CONDITION_LABELS[a.condition] ?? a.condition}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge
                        variant={a.state === "bad" ? "destructive" : a.state === "regular" ? "outline" : "secondary"}
                        className="text-[10px]"
                      >
                        {STATE_LABELS[a.state] ?? a.state}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailAsset(a)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(a.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Form Dialog */}
      <AssetFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        asset={editingAsset}
        businessId={businessId}
        branchId={branchId}
      />

      {/* Detail Sheet */}
      {detailAsset && (
        <AssetDetailSheet
          open={!!detailAsset}
          onOpenChange={(v) => { if (!v) setDetailAsset(null); }}
          asset={detailAsset}
          businessId={businessId}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar activo</AlertDialogTitle>
            <AlertDialogDescription>¿Estás seguro? Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMut.mutate(deleteId)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
