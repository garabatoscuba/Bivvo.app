import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChefHat, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import { convertUnits } from '@/lib/unitConversion';
import type { Product } from '@/types/database';

interface ProductionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  branchId: string;
}

interface RecipeIngredient {
  id: string;
  ingredient_id: string;
  quantity: number;
  unit: string;
  ingredient_type: string;
  gramaje: number;
  ingredient?: { id: string; name: string; cost_price: number; unit_of_measure: string };
}

interface BottleneckInfo {
  maxUnits: number;
  bottleneck: { name: string; available: number; needed: number; unit: string } | null;
  breakdown: { name: string; maxUnits: number; available: number; needed: number; unit: string }[];
}

export const ProductionDialog = ({ open, onOpenChange, product, branchId }: ProductionDialogProps) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const auditLog = useAuditLog();
  const [quantity, setQuantity] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Fetch recipe + ingredients + stock to calculate max production
  const { data: productionInfo, isLoading: infoLoading } = useQuery({
    queryKey: ['production-info', product?.id, branchId],
    queryFn: async (): Promise<BottleneckInfo> => {
      if (!product?.id) return { maxUnits: 0, bottleneck: null, breakdown: [] };

      // Get active recipe
      const { data: recipe } = await supabase
        .from('recipes')
        .select('id, yield_quantity')
        .eq('product_id', product.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!recipe) return { maxUnits: 0, bottleneck: null, breakdown: [] };

      // Get base ingredients
      const { data: ingredients } = await supabase
        .from('recipe_ingredients')
        .select('*, ingredient:products!recipe_ingredients_ingredient_id_fkey(id, name, unit_of_measure)')
        .eq('recipe_id', recipe.id)
        .eq('ingredient_type', 'base');

      if (!ingredients || ingredients.length === 0) return { maxUnits: Infinity, bottleneck: null, breakdown: [] };

      // Get stock for all ingredient products in this branch
      const ingredientIds = ingredients.map(i => i.ingredient_id);
      const { data: stocks } = await supabase
        .from('branch_stock')
        .select('product_id, quantity')
        .eq('branch_id', branchId)
        .in('product_id', ingredientIds);

      const stockMap = new Map((stocks || []).map(s => [s.product_id, s.quantity]));
      const yieldQty = recipe.yield_quantity || 1;

      const breakdown: BottleneckInfo['breakdown'] = [];

      for (const ri of (ingredients as unknown as RecipeIngredient[])) {
        const available = stockMap.get(ri.ingredient_id) || 0;
        const neededPerBatch = ri.quantity; // quantity per recipe batch
        const purchaseUnit = ri.ingredient?.unit_of_measure || 'pieza';

        // Convert recipe unit to purchase unit for stock comparison
        let neededInStockUnit = neededPerBatch;
        if (ri.unit && ri.unit !== purchaseUnit) {
          const converted = convertUnits(neededPerBatch, ri.unit, purchaseUnit);
          if (converted !== null) neededInStockUnit = converted;
        }

        const maxFromThis = neededInStockUnit > 0
          ? Math.floor((available / neededInStockUnit) * yieldQty)
          : Infinity;

        breakdown.push({
          name: ri.ingredient?.name || 'Desconocido',
          maxUnits: maxFromThis,
          available,
          needed: neededInStockUnit,
          unit: purchaseUnit,
        });
      }

      const minItem = breakdown.reduce((min, item) =>
        item.maxUnits < min.maxUnits ? item : min, breakdown[0]);

      return {
        maxUnits: minItem?.maxUnits ?? 0,
        bottleneck: minItem && minItem.maxUnits < Infinity ? {
          name: minItem.name,
          available: minItem.available,
          needed: minItem.needed,
          unit: minItem.unit,
        } : null,
        breakdown,
      };
    },
    enabled: open && !!product?.id && !!branchId,
  });

  const maxUnits = productionInfo?.maxUnits ?? Infinity;
  const isMaxKnown = maxUnits !== Infinity && maxUnits > 0;

  const handleClose = (value: boolean) => {
    if (!value) setQuantity(0);
    onOpenChange(value);
  };

  const handleSubmit = async () => {
    if (!product || !profile?.user_id || !branchId || quantity <= 0) return;

    setSubmitting(true);
    try {
      // Add to "En venta" stock
      const { data: existing } = await supabase
        .from('branch_stock')
        .select('id, quantity')
        .eq('branch_id', branchId)
        .eq('product_id', product.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('branch_stock')
          .update({ quantity: existing.quantity + quantity })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('branch_stock')
          .insert({ branch_id: branchId, product_id: product.id, quantity });
      }

      // Register production movement
      await supabase.from('inventory_movements').insert({
        branch_id: branchId,
        product_id: product.id,
        user_id: profile.user_id,
        movement_type: 'purchase' as const,
        quantity,
        notes: `Producción: ${quantity} unidades elaboradas`,
      });

      queryClient.invalidateQueries({ queryKey: ['branch-stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['production-info'] });
      toast({ title: `${quantity} unidades de ${product.name} registradas` });
      auditLog(
        'inventory_entry',
        `Producción de ${quantity} unidades de ${product.name}`,
        product.id,
        'product'
      );
      handleClose(false);
    } catch (err: any) {
      toast({ title: 'Error al registrar producción', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-primary" />
            Registrar producción
          </DialogTitle>
          <DialogDescription>{product?.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Suggested production */}
          {infoLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Calculando capacidad...
            </div>
          ) : isMaxKnown ? (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-1.5">
              <p className="text-sm font-medium">
                Puedes producir hasta <span className="text-primary font-bold">{maxUnits}</span> unidades
              </p>
              {productionInfo?.bottleneck && (
                <div className="flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Limitante: <span className="font-medium">{productionInfo.bottleneck.name}</span>
                    {' '}({productionInfo.bottleneck.available} {productionInfo.bottleneck.unit} disponible,
                    necesitas {productionInfo.bottleneck.needed} {productionInfo.bottleneck.unit} por lote)
                  </p>
                </div>
              )}
              {productionInfo?.breakdown && productionInfo.breakdown.length > 1 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {productionInfo.breakdown.map(b => (
                    <Badge
                      key={b.name}
                      variant={b.maxUnits === maxUnits ? 'destructive' : 'secondary'}
                      className="text-[10px]"
                    >
                      {b.name}: {b.maxUnits === Infinity ? '∞' : b.maxUnits}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ) : maxUnits === 0 ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm text-destructive font-medium">No hay stock suficiente para producir.</p>
              {productionInfo?.bottleneck && (
                <p className="text-xs text-muted-foreground mt-1">
                  Falta: {productionInfo.bottleneck.name} (stock: {productionInfo.bottleneck.available} {productionInfo.bottleneck.unit})
                </p>
              )}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label>¿Cuántas unidades produjo cocina?</Label>
            <Input
              type="number"
              min={1}
              max={isMaxKnown ? maxUnits : undefined}
              value={quantity || ''}
              onChange={(e) => {
                const val = Math.max(0, parseInt(e.target.value) || 0);
                setQuantity(isMaxKnown ? Math.min(val, maxUnits) : val);
              }}
              placeholder={isMaxKnown ? `Máx: ${maxUnits}` : 'Ej: 10'}
              autoFocus
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Se agregarán al stock "En venta" de esta sucursal.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting || quantity <= 0 || (maxUnits === 0)}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar ({quantity})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
