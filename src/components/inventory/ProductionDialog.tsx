import { useState } from 'react';
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
import { Loader2, ChefHat } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import type { Product } from '@/types/database';

interface ProductionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  branchId: string;
}

export const ProductionDialog = ({ open, onOpenChange, product, branchId }: ProductionDialogProps) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const auditLog = useAuditLog();
  const [quantity, setQuantity] = useState(0);
  const [submitting, setSubmitting] = useState(false);

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
        movement_type: 'purchase' as const, // Using purchase as closest type
        quantity,
        notes: `Producción: ${quantity} unidades elaboradas`,
      });

      queryClient.invalidateQueries({ queryKey: ['branch-stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
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
          <div className="space-y-1.5">
            <Label>¿Cuántas unidades produjo cocina?</Label>
            <Input
              type="number"
              min={1}
              value={quantity || ''}
              onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="Ej: 10"
              autoFocus
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Se agregarán al stock "En venta" de esta sucursal.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting || quantity <= 0}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar ({quantity})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
