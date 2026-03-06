import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, StopCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface CerrarJornadaGerenteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jornada: {
    id: string;
    apertura_at: string;
    empleado_id: string;
  };
  employeeName: string;
}

const CerrarJornadaGerenteModal = ({
  open, onOpenChange, jornada, employeeName,
}: CerrarJornadaGerenteModalProps) => {
  const [closing, setClosing] = useState(false);
  const [notas, setNotas] = useState('');
  const queryClient = useQueryClient();

  const diffMin = Math.floor((Date.now() - new Date(jornada.apertura_at).getTime()) / 60000);

  const handleClose = async () => {
    setClosing(true);
    const { error } = await supabase
      .from('jornadas')
      .update({
        cierre_at: new Date().toISOString(),
        duracion_min: diffMin,
        metodo_cierre: 'gerente',
        incidencia: true,
        notas: notas.trim() || null,
      })
      .eq('id', jornada.id);

    // Auto-close open cash register for this employee
    // Resolve auth user_id from profile id (empleado_id)
    const { data: empProfile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('id', jornada.empleado_id)
      .maybeSingle();
    if (empProfile?.user_id) {
      await supabase
        .from('cash_registers')
        .update({ status: 'closed', closed_at: new Date().toISOString(), notes: 'Cierre automático al cerrar jornada por gerente' } as any)
        .eq('user_id', empProfile.user_id)
        .eq('status', 'open');
    }

    setClosing(false);
    if (error) {
      toast.error('Error: ' + error.message);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['jornadas-activas-business'] });
    queryClient.invalidateQueries({ queryKey: ['jornada-activa'] });
    queryClient.invalidateQueries({ queryKey: ['active-cash-register'] });
    queryClient.invalidateQueries({ queryKey: ['owner-open-registers'] });
    toast.success(`Jornada de ${employeeName} cerrada`);
    onOpenChange(false);
    setNotas('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cerrar jornada de {employeeName}</DialogTitle>
          <DialogDescription>
            Se marcará como incidencia (cierre por gerente).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Label htmlFor="notas">Nota (opcional)</Label>
          <Textarea
            id="notas"
            value={notas}
            onChange={e => setNotas(e.target.value)}
            placeholder="Motivo del cierre..."
            rows={2}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={handleClose} disabled={closing} className="gap-2">
            {closing ? <Loader2 className="h-4 w-4 animate-spin" /> : <StopCircle className="h-4 w-4" />}
            Cerrar jornada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CerrarJornadaGerenteModal;
