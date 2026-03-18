import { useState, useEffect } from 'react';
import { useAuditLog } from '@/hooks/useAuditLog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, PackagePlus, MapPin, User, FileText, DollarSign, Tag, Ruler, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import type { Product } from '@/types/database';

interface StockEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  branchId: string;
}

const ENTRY_REASONS = [
  { value: 'purchase', label: 'Compra a proveedor' },
  { value: 'return_client', label: 'Devolución de cliente' },
  { value: 'transfer_in', label: 'Recepción de otra sucursal' },
  { value: 'production', label: 'Producción propia' },
  { value: 'inventory_adjustment', label: 'Ajuste de inventario' },
  { value: 'donation_in', label: 'Donación recibida' },
  { value: 'other', label: 'Otro motivo' },
] as const;

export const StockEntryDialog = ({ open, onOpenChange, product, branchId }: StockEntryDialogProps) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const auditLog = useAuditLog();

  const [qtyForSale, setQtyForSale] = useState(0);
  const [qtyWarehouse, setQtyWarehouse] = useState(0);
  const [reason, setReason] = useState('');
  const [origin, setOrigin] = useState('');
  const [authorizedBy, setAuthorizedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [newSalePrice, setNewSalePrice] = useState('');
  const [supplier, setSupplier] = useState('');
  const [freightCost, setFreightCost] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [purchaseUnit, setPurchaseUnit] = useState((product as any)?.unit_of_measure || (product as any)?.unit || 'Pieza');

  const resetForm = () => {
    setQtyForSale(0);
    setQtyWarehouse(0);
    setReason('');
    setOrigin('');
    setAuthorizedBy('');
    setNotes('');
    setUnitCost('');
    setNewSalePrice('');
    setSupplier('');
    setFreightCost('');
    setPurchaseUnit((product as any)?.unit_of_measure || (product as any)?.unit || 'Pieza');
  };

  const handleClose = (value: boolean) => {
    if (!value) resetForm();
    onOpenChange(value);
  };

  const isIngrediente = (product as any)?.tipo === 'ingrediente';
  const isGranel = (product as any)?.tipo === 'granel';
  const isRawMaterial = !!(product as any)?._isRawMaterial;
  const insumoAreaId = (product as any)?.insumo_area_id as string | null;

  // Fetch area name for ingredientes
  const { data: areaName } = useQuery({
    queryKey: ['insumo-area-name', insumoAreaId],
    queryFn: async () => {
      if (!insumoAreaId) return null;
      const { data } = await supabase
        .from('insumo_areas')
        .select('name')
        .eq('id', insumoAreaId)
        .single();
      return data?.name || null;
    },
    enabled: !!insumoAreaId && isIngrediente,
  });

  const saleLabel = isIngrediente
    ? (areaName ? `Cantidad a ${areaName}` : 'Cantidad a venta')
    : 'Cantidad a venta';

  const totalQty = isGranel ? qtyForSale : qtyForSale + qtyWarehouse;
  const effectiveCostPerUnit = unitCost ? parseFloat(unitCost) + (parseFloat(freightCost || '0') / (totalQty || 1)) : 0;
  const reasonLabel = ENTRY_REASONS.find(r => r.value === reason)?.label || reason;

  const handleSubmit = async () => {
    if (!product || !profile?.user_id || !branchId) return;
    if (totalQty <= 0) return;

    setSubmitting(true);
    try {
      if (isRawMaterial) {
        // Raw materials use stock_vendedor / stock_almacen on the raw_materials table
        const { data: mat } = await supabase
          .from('raw_materials')
          .select('id, stock_vendedor, stock_almacen, costo_unitario')
          .eq('id', product.id)
          .single();

        if (mat) {
          const newStockVendedor = (mat.stock_vendedor || 0) + qtyForSale;
          const newStockAlmacen = (mat.stock_almacen || 0) + qtyWarehouse;
          
          // Weighted average cost
          const oldTotal = (mat.stock_vendedor || 0) + (mat.stock_almacen || 0);
          const oldCost = mat.costo_unitario || 0;
          const newCost = effectiveCostPerUnit > 0 ? effectiveCostPerUnit : oldCost;
          const avgCost = (oldTotal + totalQty) > 0
            ? ((oldTotal * oldCost) + (totalQty * newCost)) / (oldTotal + totalQty)
            : newCost;

          await supabase
            .from('raw_materials')
            .update({
              stock_vendedor: newStockVendedor,
              stock_almacen: newStockAlmacen,
              costo_unitario: Math.round(avgCost * 10000) / 10000,
              unit_purchase: purchaseUnit,
            })
            .eq('id', product.id);
        }
      } else {
        const { data: existing } = await supabase
          .from('branch_stock')
          .select('id, quantity, warehouse_quantity')
          .eq('branch_id', branchId)
          .eq('product_id', product.id)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('branch_stock')
            .update({
              quantity: existing.quantity + qtyForSale,
              warehouse_quantity: isGranel ? (existing.warehouse_quantity || 0) : (existing.warehouse_quantity || 0) + qtyWarehouse,
            })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('branch_stock')
            .insert({
              branch_id: branchId,
              product_id: product.id,
              quantity: qtyForSale,
              warehouse_quantity: isGranel ? 0 : qtyWarehouse,
            });
        }
      }

      if (isGranel) {
        const detailParts = [
          `Pasar a venta: ${qtyForSale} unidades`,
          newSalePrice ? `Precio venta: $${parseFloat(newSalePrice).toFixed(2)}` : null,
          notes.trim() ? `Obs: ${notes.trim()}` : null,
        ].filter(Boolean);

        await supabase.from('inventory_movements').insert({
          branch_id: branchId,
          product_id: product.id,
          user_id: profile.user_id,
          movement_type: 'purchase' as const,
          quantity: totalQty,
          notes: detailParts.join(' | '),
        });
      } else {
        const detailParts = [
          `Entrada: ${reasonLabel}`,
          isIngrediente
            ? `${qtyForSale} ${areaName || 'uso'}, ${qtyWarehouse} almacén`
            : `${qtyForSale} venta, ${qtyWarehouse} almacén`,
          `Costo: $${parseFloat(unitCost).toFixed(2)}`,
          ...(!isIngrediente ? [`Venta: $${parseFloat(newSalePrice).toFixed(2)}`] : []),
          `Origen: ${origin.trim()}`,
          `Autoriza: ${authorizedBy.trim()}`,
          notes.trim() ? `Obs: ${notes.trim()}` : null,
        ].filter(Boolean);

        await supabase.from('inventory_movements').insert({
          branch_id: branchId,
          product_id: product.id,
          user_id: profile.user_id,
          movement_type: 'purchase' as const,
          quantity: totalQty,
          notes: detailParts.join(' | '),
        });
      }

      // Save stock entry for Treasury cost tracking (skip for granel)
      if (!isGranel) {
        const businessId = profile.business_id || (await supabase.from('branches').select('business_id').eq('id', branchId).single()).data?.business_id;
        if (businessId) {
          await supabase.from('product_stock_entries' as any).insert({
            business_id: businessId,
            branch_id: branchId,
            product_id: product.id,
            user_id: profile.user_id,
            quantity: totalQty,
            unit_cost: effectiveCostPerUnit > 0 ? effectiveCostPerUnit : (unitCost ? parseFloat(unitCost) : null),
            sale_price: !isIngrediente && newSalePrice ? parseFloat(newSalePrice) : null,
            supplier: supplier.trim() || null,
            notes: notes.trim() || null,
            reason: reason || null,
          });
        }
      }

      // Update product prices
      if (isGranel) {
        if (newSalePrice && parseFloat(newSalePrice) > 0) {
          await supabase
            .from('products')
            .update({ sale_price: parseFloat(newSalePrice) })
            .eq('id', product.id);
        }
        queryClient.invalidateQueries({ queryKey: ['products'] });
      } else if (isIngrediente) {
        queryClient.invalidateQueries({ queryKey: ['products'] });
        queryClient.invalidateQueries({ queryKey: ['recipe-ingredients'] });
        queryClient.invalidateQueries({ queryKey: ['recipe'] });
      } else if (!isIngrediente && newSalePrice && parseFloat(newSalePrice) > 0) {
        await supabase
          .from('products')
          .update({ sale_price: parseFloat(newSalePrice) })
          .eq('id', product.id);
        queryClient.invalidateQueries({ queryKey: ['products'] });
      }

      queryClient.invalidateQueries({ queryKey: ['branch-stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['bp-product-cost'] });
      if (isRawMaterial) {
        queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
        queryClient.invalidateQueries({ queryKey: ['raw-materials-for-products'] });
      }

      const toastTitle = isGranel
        ? `${totalQty} unidades pasadas a venta`
        : `Entrada de ${totalQty} unidades registrada`;
      toast({ title: toastTitle });
      auditLog(
        'inventory_entry',
        isGranel
          ? `Pasó ${totalQty} unidades de ${product?.name} a venta`
          : `Entrada de ${totalQty} unidades de ${product?.name} a $${parseFloat(unitCost || '0').toFixed(2)} c/u`,
        product?.id,
        'product'
      );
      handleClose(false);
    } catch (err: any) {
      toast({ title: isGranel ? 'Error al pasar a venta' : 'Error al dar entrada', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = totalQty > 0;

  // ── Granel simplified view ──
  if (isGranel) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-primary" />
              Pasar a venta
            </DialogTitle>
            <DialogDescription>
              {product?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Cantidad</Label>
              <Input
                type="number"
                min={0}
                value={qtyForSale}
                onChange={(e) => setQtyForSale(Math.max(0, parseInt(e.target.value) || 0))}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                Precio de venta
              </Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="Precio de venta por unidad"
                value={newSalePrice}
                onChange={(e) => setNewSalePrice(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Observaciones</Label>
              <Textarea
                placeholder="Detalles adicionales..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={submitting || !isValid}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Standard view (reventa / ingrediente / elaborado) ──
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-primary" />
            Nueva Compra
          </DialogTitle>
          <DialogDescription>
            {product?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 overflow-y-auto flex-1 min-h-0">
          {/* Quantities */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{saleLabel}</Label>
              <Input
                type="number"
                min={0}
                value={qtyForSale}
                onChange={(e) => setQtyForSale(Math.max(0, parseInt(e.target.value) || 0))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cantidad a almacén</Label>
              <Input
                type="number"
                min={0}
                value={qtyWarehouse}
                onChange={(e) => setQtyWarehouse(Math.max(0, parseInt(e.target.value) || 0))}
              />
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              Motivo de entrada
            </Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el motivo" />
              </SelectTrigger>
              <SelectContent>
                {ENTRY_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Origin */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              Origen / Proveedor
            </Label>
            <Input
              placeholder="Ej: Proveedor X, Sucursal Norte, Cliente Y..."
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
            />
          </div>

          {/* Authorized by */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              Autorizado por
            </Label>
            <Input
              placeholder="Nombre de quien autoriza"
              value={authorizedBy}
              onChange={(e) => setAuthorizedBy(e.target.value)}
            />
          </div>

          {/* Cost & Price */}
          <div className={isIngrediente ? '' : 'grid grid-cols-2 gap-4'}>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                Costo unitario
              </Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="Precio que pagaste"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                required
              />
            </div>
            {!isIngrediente && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  Precio de venta
                </Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Nuevo precio de venta"
                  value={newSalePrice}
                  onChange={(e) => setNewSalePrice(e.target.value)}
                  required
                />
              </div>
            )}
          </div>

          {/* Freight / transport cost */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <Truck className="h-3.5 w-3.5 text-muted-foreground" />
              Costo de transporte/flete (opcional)
            </Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="Ej: 50.00"
              value={freightCost}
              onChange={(e) => setFreightCost(e.target.value)}
            />
            {parseFloat(freightCost || '0') > 0 && totalQty > 0 && unitCost && (
              <p className="text-xs text-muted-foreground">
                Costo unitario real: ${effectiveCostPerUnit.toFixed(2)} (${unitCost} + ${(parseFloat(freightCost) / totalQty).toFixed(2)} flete)
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
              Unidad de medida
            </Label>
            <Select value={purchaseUnit} onValueChange={setPurchaseUnit}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona unidad" />
              </SelectTrigger>
              <SelectContent>
                {['Pieza','Kilogramo','Gramo','Libra','Litro','Mililitro','Metro','Metro cuadrado (m²)','Centímetro','Caja','Paquete','Par','Docena','Rollo'].map(u => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Observaciones</Label>
            <Textarea
              placeholder="Detalles adicionales..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting || !isValid}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar Compra ({totalQty})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};