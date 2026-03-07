
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { Asset } from "./AssetsTab";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  asset: Asset | null;
  businessId: string;
  branchId: string | null;
}

export default function AssetFormDialog({ open, onOpenChange, asset, businessId, branchId }: Props) {
  const qc = useQueryClient();
  const isEdit = !!asset;

  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [acquisitionDate, setAcquisitionDate] = useState("");
  const [supplier, setSupplier] = useState("");
  const [acquisitionCost, setAcquisitionCost] = useState("");
  const [assetClass, setAssetClass] = useState("furniture");
  const [location, setLocation] = useState("");
  const [responsible, setResponsible] = useState("");
  const [depMethod, setDepMethod] = useState("straight_line");
  const [usefulLife, setUsefulLife] = useState("");
  const [residualValue, setResidualValue] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [condition, setCondition] = useState("in_use");
  const [state, setState] = useState("good");
  const [observations, setObservations] = useState("");

  /* auto-generate next code */
  const { data: nextCode } = useQuery({
    queryKey: ["next-asset-code", businessId],
    enabled: open && !isEdit,
    queryFn: async () => {
      const { data } = await supabase
        .from("accounting_assets")
        .select("code")
        .eq("business_id", businessId)
        .not("code", "is", null)
        .order("code", { ascending: false })
        .limit(50);
      const codes = (data ?? []).map((r) => r.code).filter(Boolean) as string[];
      let maxNum = 0;
      for (const c of codes) {
        const m = c.match(/AF-(\d+)/);
        if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
      }
      return `AF-${String(maxNum + 1).padStart(3, "0")}`;
    },
  });

  useEffect(() => {
    if (!open) return;
    if (isEdit && asset) {
      setDescription(asset.description);
      setCode(asset.code ?? "");
      setAcquisitionDate(asset.acquisition_date ?? "");
      setSupplier(asset.supplier ?? "");
      setAcquisitionCost(String(asset.acquisition_cost));
      setAssetClass(asset.asset_class);
      setLocation(asset.location ?? "");
      setResponsible(asset.responsible ?? "");
      setDepMethod(asset.depreciation_method ?? "straight_line");
      setUsefulLife(asset.useful_life_months != null ? String(asset.useful_life_months) : "");
      setResidualValue(asset.residual_value != null ? String(asset.residual_value) : "");
      setQuantity(String(asset.quantity));
      setCondition(asset.condition);
      setState(asset.state);
      setObservations(asset.observations ?? "");
    } else {
      setDescription("");
      setCode(nextCode ?? "AF-001");
      setAcquisitionDate(new Date().toISOString().slice(0, 10));
      setSupplier("");
      setAcquisitionCost("");
      setAssetClass("furniture");
      setLocation("");
      setResponsible("");
      setDepMethod("straight_line");
      setUsefulLife("");
      setResidualValue("0");
      setQuantity("1");
      setCondition("in_use");
      setState("good");
      setObservations("");
    }
  }, [open, asset, isEdit, nextCode]);

  const mutation = useMutation({
    mutationFn: async () => {
      const cost = parseFloat(acquisitionCost) || 0;
      const row: any = {
        business_id: businessId,
        branch_id: branchId,
        description,
        code: code || null,
        acquisition_date: acquisitionDate || null,
        supplier: supplier || null,
        acquisition_cost: cost,
        adjusted_cost: isEdit ? asset!.adjusted_cost : cost,
        asset_class: assetClass,
        location: location || null,
        responsible: responsible || null,
        depreciation_method: depMethod,
        useful_life_months: usefulLife ? parseInt(usefulLife, 10) : null,
        residual_value: residualValue ? parseFloat(residualValue) : 0,
        quantity: parseInt(quantity, 10) || 1,
        condition,
        state,
        observations: observations || null,
      };

      if (isEdit) {
        // On edit, if acquisition_cost changed recalculate adjusted_cost
        if (cost !== asset!.acquisition_cost) {
          const diff = cost - asset!.acquisition_cost;
          row.adjusted_cost = asset!.adjusted_cost + diff;
        }
        const { error } = await supabase.from("accounting_assets").update(row).eq("id", asset!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("accounting_assets").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Activo actualizado" : "Activo registrado");
      qc.invalidateQueries({ queryKey: ["accounting-assets"] });
      qc.invalidateQueries({ queryKey: ["next-asset-code"] });
      onOpenChange(false);
    },
    onError: () => toast.error("Error al guardar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Activo" : "Agregar Activo"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Descripción *</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Código</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="AF-001" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Fecha de adquisición</Label>
              <Input type="date" value={acquisitionDate} onChange={(e) => setAcquisitionDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Proveedor</Label>
              <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Costo de adquisición *</Label>
              <Input type="number" min="0" step="0.01" value={acquisitionCost} onChange={(e) => setAcquisitionCost(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Clasificación</Label>
              <Select value={assetClass} onValueChange={setAssetClass}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="property">Inmueble</SelectItem>
                  <SelectItem value="machinery">Maquinaria y Equipo</SelectItem>
                  <SelectItem value="furniture">Mobiliario</SelectItem>
                  <SelectItem value="tools">Herramientas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Ubicación</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Responsable</Label>
              <Input value={responsible} onChange={(e) => setResponsible(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Método de depreciación</Label>
              <Select value={depMethod} onValueChange={setDepMethod}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="straight_line">Línea Recta</SelectItem>
                  <SelectItem value="declining_balance">Saldo Decreciente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Vida útil (meses)</Label>
              <Input type="number" min="1" value={usefulLife} onChange={(e) => setUsefulLife(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Valor residual</Label>
              <Input type="number" min="0" step="0.01" value={residualValue} onChange={(e) => setResidualValue(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Cantidad</Label>
              <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Condición</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_use">En Uso</SelectItem>
                  <SelectItem value="deprecated">Depreciado</SelectItem>
                  <SelectItem value="stored">Almacenado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Estado</Label>
            <Select value={state} onValueChange={setState}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="good">Bueno</SelectItem>
                <SelectItem value="regular">Regular</SelectItem>
                <SelectItem value="bad">Malo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Observaciones</Label>
            <Textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={!description || !acquisitionCost || mutation.isPending}>
            {mutation.isPending ? "Guardando…" : isEdit ? "Actualizar" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
