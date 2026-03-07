import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useAuditLog } from '@/hooks/useAuditLog';
import JornadaSummaryBlock from '@/components/employees/JornadaSummaryBlock';

interface CerrarJornadaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jornada: {
    id: string;
    apertura_at: string;
    empleado_id: string;
  };
}

function calcDuration(apertura: string): { text: string; minutes: number } {
  const start = new Date(apertura).getTime();
  const now = Date.now();
  const diffMs = now - start;
  const minutes = Math.floor(diffMs / 60000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return {
    text: h > 0 ? `${h}h ${m}m` : `${m}m`,
    minutes,
  };
}

const CerrarJornadaModal = ({ open, onOpenChange, jornada }: CerrarJornadaModalProps) => {
  const [closing, setClosing] = useState(false);
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const auditLog = useAuditLog();

  const duration = calcDuration(jornada.apertura_at);
  const entryTime = new Date(jornada.apertura_at).toLocaleTimeString('es', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleClose = async () => {
    setClosing(true);
    const { error } = await supabase
      .from('jornadas')
      .update({
        cierre_at: new Date().toISOString(),
        duracion_min: duration.minutes,
        metodo_cierre: 'manual',
      })
      .eq('id', jornada.id);

    // Auto-close open cash register for this employee (use auth user_id)
    if (profile?.user_id) {
      await supabase
        .from('cash_registers')
        .update({ status: 'closed', closed_at: new Date().toISOString(), notes: 'Cierre automático al cerrar jornada' } as any)
        .eq('user_id', profile.user_id)
        .eq('status', 'open');
    }

    setClosing(false);
    if (error) {
      toast.error('Error al cerrar jornada: ' + error.message);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['jornada-activa'] });
    queryClient.invalidateQueries({ queryKey: ['active-cash-register'] });
    queryClient.invalidateQueries({ queryKey: ['owner-open-registers'] });
    toast.success('Jornada cerrada. ¡Hasta luego! 👋');
    auditLog('shift_ended', `Jornada cerrada — Duración: ${duration.text}`, jornada.id, 'jornada');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cerrar jornada</DialogTitle>
          <DialogDescription>
            ¿Estás seguro que deseas cerrar tu jornada laboral?
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border p-4 space-y-2 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Hora de entrada</p>
            <p className="text-lg font-semibold">{entryTime}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tiempo trabajado</p>
            <p className="text-lg font-semibold">{duration.text}</p>
          </div>
        </div>

        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1">
          <div className="flex items-center gap-2 text-destructive text-sm font-medium">
            <AlertTriangle className="h-4 w-4" />
            Advertencia
          </div>
          <p className="text-xs text-muted-foreground">
            Al cerrar tu jornada perderás el salario del día. Asegúrate de haber terminado de contar antes de cerrar.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleClose} disabled={closing} className="gap-2">
            {closing ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Cerrar jornada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CerrarJornadaModal;
