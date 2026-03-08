import { useState } from 'react';
import { useAuditLog } from '@/hooks/useAuditLog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, PackagePlus, MapPin, User, FileText, DollarSign, Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
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
  const [submitting, setSubmitting] = useState(false);

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
  };

  const handleClose = (value: boolean) => {
    if (!value) resetForm();
    onOpenChange(value);
  };

  const isIngrediente = product?.tipo === 'ingrediente';
  const totalQty = qtyForSale + qtyWarehouse;
  const reasonLabel = ENTRY_REASONS.find(r => r.value === reason)?.label || reason;

  const handleSubmit = async () => {
    if (!product || !profile?.user_id || !branchId) return;
    if (totalQty <= 0) return;

    setSubmitting(true);
    try {
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
            warehouse_quantity: (existing.warehouse_quantity || 0) + qtyWarehouse,
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('branch_stock')
          .insert({
            branch_id: branchId,
            product_id: product.id,
            quantity: qtyForSale,
            warehouse_quantity: qtyWarehouse,
          });
      }

      const detailParts = [
        `Entrada: ${reasonLabel}`,
        isIngrediente
          ? `${qtyForSale} cocina, ${qtyWarehouse} almacén`
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

      // Save stock entry for Treasury cost tracking
      const businessId = profile.business_id || (await supabase.from('branches').select('business_id').eq('id', branchId).single()).data?.business_id;
      if (businessId) {
        await supabase.from('product_stock_entries' as any).insert({
          business_id: businessId,
          branch_id: branchId,
          product_id: product.id,
          user_id: profile.user_id,
          quantity: totalQty,
          unit_cost: unitCost ? parseFloat(unitCost) : null,
          sale_price: !isIngrediente && newSalePrice ? parseFloat(newSalePrice) : null,
          supplier: supplier.trim() || null,
          notes: notes.trim() || null,
          reason: reason || null,
        });
      }

      // Update product sale_price if user provided a new one
      if (newSalePrice && parseFloat(newSalePrice) > 0) {
        await supabase
          .from('products')
          .update({ sale_price: parseFloat(newSalePrice) })
          .eq('id', product.id);
        queryClient.invalidateQueries({ queryKey: ['products'] });
      }

      queryClient.invalidateQueries({ queryKey: ['branch-stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['bp-product-cost'] });
      toast({ title: `Entrada de ${totalQty} unidades registrada` });
      auditLog(
        'inventory_entry',
        `Entrada de ${totalQty} unidades de ${product?.name} a $${parseFloat(unitCost || '0').toFixed(2)} c/u`,
        product?.id,
        'product'
      );
      handleClose(false);
    } catch (err: any) {
      toast({ title: 'Error al dar entrada', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = totalQty > 0;

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
              <Label>Cantidad a venta</Label>
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
          <div className="grid grid-cols-2 gap-4">
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
          </div>

          {/* Notes */}
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
