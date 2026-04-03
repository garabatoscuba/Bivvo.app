import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Database, CalendarClock, Trash2, Loader2, AlertTriangle, ShieldAlert, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

export default function DataManagement() {
  const [periodOpen, setPeriodOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Gestión de Datos</h3>
        <p className="text-sm text-muted-foreground">
          Controla los datos operativos de tu negocio.
        </p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Database className="h-4 w-4" />
            Gestión de Datos
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onClick={() => setPeriodOpen(true)} className="gap-2 cursor-pointer">
            <CalendarClock className="h-4 w-4" />
            Cerrar Período
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setResetOpen(true)} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4" />
            Reset Completo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <PeriodCloseModal open={periodOpen} onOpenChange={setPeriodOpen} />
      <ResetCompletoModal open={resetOpen} onOpenChange={setResetOpen} />
    </div>
  );
}

/* ─── Cerrar Período ─── */
function PeriodCloseModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleConfirm = async () => {
    if (!profile?.business_id) return;
    setLoading(true);

    try {
      const now = new Date().toISOString();
      const businessId = profile.business_id;

      const archiveTables = ['sales', 'cash_register_movements', 'treasury_movements', 'jornadas', 'daily_reports', 'service_entries'] as const;
      for (const table of archiveTables) {
        const { error } = await (supabase.from(table) as any)
          .update({ archived: true, archived_at: now })
          .eq('business_id', businessId)
          .eq('archived', false);
        if (error) console.error(`Archive ${table}:`, error);
      }

      // Reset dashboard
      await supabase
        .from('businesses')
        .update({ dashboard_reset_at: now } as any)
        .eq('id', businessId);

      queryClient.invalidateQueries();
      toast.success('Período cerrado. Los indicadores activos están en cero.');
      onOpenChange(false);
    } catch (err: any) {
      console.error('Period close error:', err);
      toast.error('Error al cerrar el período');
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Cerrar Período
          </DialogTitle>
          <DialogDescription>
            ¿Estás seguro? Las ventas del período actual quedarán archivadas y los indicadores activos volverán a cero. Los reportes históricos seguirán accesibles.
          </DialogDescription>
        </DialogHeader>
        <Alert className="border-amber-500/50">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertTitle>Acción moderada</AlertTitle>
          <AlertDescription>
            Los datos no se eliminan, solo se archivan. El historial y reportes seguirán disponibles.
          </AlertDescription>
        </Alert>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleConfirm} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CalendarClock className="h-4 w-4 mr-1" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Reset Completo ─── */
function ResetCompletoModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const isConfirmed = confirmText === 'CONFIRMAR';

  const handleClose = () => {
    setConfirmText('');
    onOpenChange(false);
  };

  const handleReset = async () => {
    if (!profile?.business_id || !isConfirmed) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('reset-business-data', {
        body: { business_id: profile.business_id },
      });

      if (error) {
        console.error('Reset error:', error);
        toast.error('Error al ejecutar el reset');
        setLoading(false);
        return;
      }

      if (data?.errors?.length) {
        console.warn('Partial reset errors:', data.errors);
      }

      queryClient.invalidateQueries();
      toast.success('Reset completado. Los datos operativos han sido eliminados.');
      handleClose();
      navigate('/');
    } catch (err: any) {
      console.error('Reset exception:', err);
      toast.error('Error al ejecutar el reset');
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Reset Completo — Irreversible
          </DialogTitle>
          <DialogDescription>
            Esta acción es irreversible. Se eliminarán permanentemente todos los datos operativos del negocio: ventas, movimientos de caja, jornadas, gastos y activos de Contabilidad, y registros de Bitácora.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>No se verán afectados</AlertTitle>
          <AlertDescription>
            Los empleados, el inventario, el catálogo de productos y la configuración del negocio se preservan intactos.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Escribe <strong className="text-foreground">CONFIRMAR</strong> para habilitar el botón.
          </p>
          <Input
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="CONFIRMAR"
            className={isConfirmed ? 'border-destructive' : ''}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button variant="destructive" onClick={handleReset} disabled={loading || !isConfirmed}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
            Eliminar datos operativos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
