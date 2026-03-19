import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ClipboardMinus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useResolvedBusinessId } from '@/hooks/useResolvedBusinessId';
import { useAuditLog } from '@/hooks/useAuditLog';

interface ConsumoInternoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: {
    id: string;
    name: string;
    unit_of_measure?: string;
    stock_vendedor?: number;
    _stockVendedor?: number;
    _isRawMaterial?: boolean;
  } | null;
}

const ConsumoInternoModal = ({ open, onOpenChange, material }: ConsumoInternoModalProps) => {
  const { profile } = useAuth();
  const { businessId, branchId } = useResolvedBusinessId();
  const queryClient = useQueryClient();
  const auditLog = useAuditLog();
  const [cantidad, setCantidad] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  const unit = material?.unit_of_measure || 'Pieza';
  const currentStock = Number(material?.stock_vendedor ?? material?._stockVendedor) || 0;

  const handleConfirm = async () => {
    if (!material || !businessId) return;
    const qty = parseFloat(cantidad);
    if (!qty || qty <= 0) {
      toast({ title: 'Cantidad inválida', variant: 'destructive' });
      return;
    }
    if (qty > currentStock) {
      toast({ title: 'Stock insuficiente', description: `Solo hay ${currentStock} ${unit} disponible.`, variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      // Deduct stock from stock_vendedor
      await supabase
        .from('raw_materials')
        .update({ stock_vendedor: currentStock - qty } as any)
        .eq('id', material.id);

      // Record in raw_material_entries
      await supabase.from('raw_material_entries').insert({
        material_id: material.id,
        cantidad: -Math.abs(qty),
        costo_unitario: 0,
        entry_type: 'consumo_interno',
        nota: motivo.trim() || null,
        business_id: businessId,
        branch_id: branchId,
        user_id: profile?.user_id,
        ...(fecha !== new Date().toISOString().slice(0, 10) ? { created_at: new Date(fecha + 'T12:00:00').toISOString() } : {}),
      } as any);

      // Audit log
      auditLog(
        'consumo_interno' as any,
        `Consumo interno: ${qty} ${unit} de ${material.name}${motivo.trim() ? ` — ${motivo.trim()}` : ''}`,
        material.id,
        'raw_material'
      );

      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      toast({ title: 'Consumo registrado' });
      onOpenChange(false);
      setCantidad('');
      setMotivo('');
      setFecha(new Date().toISOString().slice(0, 10));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setCantidad(''); setMotivo(''); setFecha(new Date().toISOString().slice(0, 10)); } onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardMinus className="h-5 w-5" />
            Registrar consumo
          </DialogTitle>
        </DialogHeader>
        {material && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {material.name} — Stock actual: <strong>{currentStock} {unit}</strong>
            </p>
            <div className="space-y-1.5">
              <Label>Cantidad consumida ({unit})</Label>
              <Input
                type="number"
                min={0}
                max={currentStock}
                step="0.01"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                placeholder={`Ej: 2`}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Motivo (opcional)</Label>
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                placeholder="Ej: limpieza semanal"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={saving || !cantidad || parseFloat(cantidad) <= 0}
          >
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConsumoInternoModal;
