import { useState, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut, Calculator } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import CashCalculator from '@/components/cobro/CashCalculator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ContarYCerrarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jornada: {
    id: string;
    apertura_at: string;
    empleado_id: string;
    sucursal_id: string;
  };
  employeeBusinessId: string;
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

const ContarYCerrarModal = ({ open, onOpenChange, jornada, employeeBusinessId }: ContarYCerrarModalProps) => {
  const [closing, setClosing] = useState(false);
  const [tipSurplus, setTipSurplus] = useState(0);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const duration = calcDuration(jornada.apertura_at);
  const entryTime = new Date(jornada.apertura_at).toLocaleTimeString('es', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleTipSurplusChange = useCallback((surplus: number) => {
    setTipSurplus(surplus);
  }, []);

  const handleClose = async () => {
    setClosing(true);

    // Save automatic tip entry if there's a surplus
    if (tipSurplus > 0 && user?.id) {
      const todayStr = new Date().toISOString().split('T')[0];
      await supabase.from('tip_entries').insert({
        business_id: employeeBusinessId,
        branch_id: jornada.sucursal_id,
        user_id: user.id,
        amount: tipSurplus,
        tip_type: 'automatic',
        jornada_id: jornada.id,
        date: todayStr,
        notes: 'Excedente de caja al cierre',
      } as any);
    }

    const { error } = await supabase
      .from('jornadas')
      .update({
        cierre_at: new Date().toISOString(),
        duracion_min: duration.minutes,
        metodo_cierre: 'manual',
      })
      .eq('id', jornada.id);

    setClosing(false);
    if (error) {
      toast.error('Error al cerrar jornada: ' + error.message);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['jornada-activa'] });
    queryClient.invalidateQueries({ queryKey: ['jornadas-activas-business'] });
    queryClient.invalidateQueries({ queryKey: ['my-today-tips'] });
    toast.success('Jornada cerrada. ¡Hasta luego! 👋');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Contar y Cerrar Jornada
          </DialogTitle>
          <DialogDescription>
            Cuenta el efectivo y revisa el resumen antes de cerrar tu jornada.
          </DialogDescription>
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
            <span>Entrada: <strong>{entryTime}</strong></span>
            <span>Duración: <strong>{duration.text}</strong></span>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] px-6">
          <CashCalculator
            employeeBusinessId={employeeBusinessId}
            employeeBranchId={jornada.sucursal_id}
            onTipSurplusChange={handleTipSurplusChange}
          />
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0 px-6 pb-6 pt-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleClose} disabled={closing} className="gap-2">
            {closing ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Cerrar Jornada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ContarYCerrarModal;
