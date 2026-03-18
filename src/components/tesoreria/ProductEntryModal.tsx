import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProducts } from "@/hooks/useProducts";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, ShoppingCart, Truck } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  branchId: string;
}

export default function ProductEntryModal({ open, onOpenChange, businessId, branchId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { products } = useProducts(businessId);

  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [costPerUnit, setCostPerUnit] = useState("");
  const [salePricePerUnit, setSalePricePerUnit] = useState("");
  const [freightCost, setFreightCost] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);

  const forSaleProducts = products.filter((p) => p.status !== "discontinued");

  const resetForm = () => {
    setProductId("");
    setQuantity("");
    setCostPerUnit("");
    setSalePricePerUnit("");
    setFreightCost("");
    setEntryDate(new Date().toISOString().split("T")[0]);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("product_entries" as any).insert({
        business_id: businessId,
        branch_id: branchId,
        product_id: productId,
        quantity: Number(quantity),
        cost_per_unit: Number(costPerUnit),
        sale_price_per_unit: Number(salePricePerUnit),
        entry_date: entryDate,
        user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bp-product-cost"] });
      queryClient.invalidateQueries({ queryKey: ["bp-unified-history"] });
      toast.success("Compra registrada");
      resetForm();
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast.error("Error: " + e.message);
    },
  });

  const isValid =
    productId &&
    Number(quantity) > 0 &&
    Number(costPerUnit) > 0 &&
    Number(salePricePerUnit) > 0 &&
    entryDate;

  // Pre-fill sale price when product selected
  const handleProductChange = (id: string) => {
    setProductId(id);
    const prod = forSaleProducts.find((p) => p.id === id);
    if (prod) {
      setSalePricePerUnit(String(prod.sale_price));
      setCostPerUnit(String(prod.cost_price));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Registrar Compra de Producto
          </DialogTitle>
          <DialogDescription>
            Registra una compra al proveedor para calcular tus costos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Producto</Label>
            <Select value={productId} onValueChange={handleProductChange}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Seleccionar producto" />
              </SelectTrigger>
              <SelectContent>
                {forSaleProducts.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Cantidad</Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              className="h-9"
              placeholder="Ej: 10"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Costo por unidad ($)</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                className="h-9"
                placeholder="Ej: 8.00"
                value={costPerUnit}
                onChange={(e) => setCostPerUnit(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Precio venta ($)</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                className="h-9"
                placeholder="Ej: 12.00"
                value={salePricePerUnit}
                onChange={(e) => setSalePricePerUnit(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Fecha de compra</Label>
            <Input
              type="date"
              className="h-9"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!isValid || mutation.isPending}
            className="gap-2"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
