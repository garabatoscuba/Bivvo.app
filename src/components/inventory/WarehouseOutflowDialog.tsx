import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, PackageX, MapPin, User, FileText, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import type { Product } from '@/types/database';

interface WarehouseOutflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  warehouseStock: number;
  branchId: string;
}

const OUTFLOW_REASONS = [
  { value: 'external_delivery', label: 'Entrega a otro local / sucursal' },
  { value: 'client_delivery', label: 'Entrega directa a cliente' },
  { value: 'sample', label: 'Muestra / Exhibición' },
  { value: 'damage', label: 'Producto dañado / Merma' },
  { value: 'return_supplier', label: 'Devolución a proveedor' },
  { value: 'donation', label: 'Donación' },
  { value: 'other', label: 'Otro motivo' },
] as const;

export const WarehouseOutflowDialog = ({
  open,
  onOpenChange,
  product,
  warehouseStock,
  branchId,
}: WarehouseOutflowDialogProps) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [destination, setDestination] = useState('');
  const [authorizedBy, setAuthorizedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setQuantity(1);
    setReason('');
    setDestination('');
    setAuthorizedBy('');
    setNotes('');
  };

  const handleClose = (value: boolean) => {
    if (!value) resetForm();
    onOpenChange(value);
  };

  const reasonLabel = OUTFLOW_REASONS.find(r => r.value === reason)?.label || reason;

  const handleSubmit = async () => {
    if (!product || !profile?.user_id || !branchId) return;
    if (quantity <= 0 || quantity > warehouseStock) return;
    if (!reason) {
      toast({ title: 'Selecciona el motivo de salida', variant: 'destructive' });
      return;
    }
    if (!destination.trim()) {
      toast({ title: 'Indica el destino', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      // Deduct from warehouse stock
      const { data: existing } = await supabase
        .from('branch_stock')
        .select('id, warehouse_quantity')
        .eq('branch_id', branchId)
        .eq('product_id', product.id)
        .maybeSingle();

      if (!existing || existing.warehouse_quantity < quantity) {
        toast({ title: 'No hay suficientes unidades en almacén', variant: 'destructive' });
        return;
      }

      await supabase
        .from('branch_stock')
        .update({ warehouse_quantity: existing.warehouse_quantity - quantity })
        .eq('id', existing.id);

      // Build detailed notes
      const detailParts = [
        `Salida almacén: ${reasonLabel}`,
        `Destino: ${destination.trim()}`,
        authorizedBy.trim() ? `Autoriza: ${authorizedBy.trim()}` : null,
        notes.trim() ? `Obs: ${notes.trim()}` : null,
      ].filter(Boolean);

      await supabase.from('inventory_movements').insert({
        branch_id: branchId,
        product_id: product.id,
        user_id: profile.user_id,
        movement_type: 'transfer_out' as const,
        quantity,
        notes: detailParts.join(' | '),
      });

      queryClient.invalidateQueries({ queryKey: ['branch-stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      toast({ title: `Salida de ${quantity} unidades registrada` });
      handleClose(false);
    } catch (err: any) {
      toast({ title: 'Error al registrar salida', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = reason && destination.trim() && quantity > 0 && quantity <= warehouseStock;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageX className="h-5 w-5 text-warning" />
            Salida de almacén
          </DialogTitle>
          <DialogDescription>
            {product?.name} — {warehouseStock} unidades disponibles
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Quantity */}
          <div className="space-y-1.5">
            <Label>Cantidad a retirar</Label>
            <div className="flex items-center gap-3">
              <Button
                variant="outline" size="icon" className="h-9 w-9"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
              >
                <span className="text-lg leading-none">−</span>
              </Button>
              <Input
                type="number"
                min={1}
                max={warehouseStock}
                value={quantity}
                onChange={(e) => setQuantity(Math.min(warehouseStock, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-20 text-center"
              />
              <Button
                variant="outline" size="icon" className="h-9 w-9"
                onClick={() => setQuantity(Math.min(warehouseStock, quantity + 1))}
                disabled={quantity >= warehouseStock}
              >
                <span className="text-lg leading-none">+</span>
              </Button>
              <span className="text-sm text-muted-foreground">/ {warehouseStock}</span>
            </div>
            {quantity >= warehouseStock && (
              <p className="text-xs text-warning flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Esto vaciará el almacén de este producto
              </p>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              Motivo de salida
            </Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el motivo" />
              </SelectTrigger>
              <SelectContent>
                {OUTFLOW_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Destination */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              Destino
            </Label>
            <Input
              placeholder="Ej: Sucursal Norte, Cliente X, Proveedor Y..."
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
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
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !isValid}
            variant="destructive"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar salida ({quantity})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
