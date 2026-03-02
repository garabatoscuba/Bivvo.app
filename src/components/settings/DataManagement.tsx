import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Eye, CalendarClock, Trash2, Loader2, AlertTriangle, ShieldAlert, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

/* ─── Layer 1: Visual Reset ─── */
function Layer1Reset() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleReset = async () => {
    if (!profile?.business_id) return;
    setLoading(true);
    const { error } = await supabase
      .from('businesses')
      .update({ dashboard_reset_at: new Date().toISOString() } as any)
      .eq('id', profile.business_id);
    setLoading(false);
    if (error) {
      toast.error('Error al resetear los indicadores');
    } else {
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Indicadores visuales reseteados');
      setOpen(false);
    }
  };

  return (
    <>
      <Card className="border-blue-500/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-blue-500/10 p-2">
              <Eye className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-base">Reset Visual</CardTitle>
              <CardDescription>Limpia los contadores del dashboard</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Reinicia los indicadores de ventas (día, semana, mes) en el dashboard a cero.
            Los reportes y el historial de ventas <strong>no se ven afectados</strong>.
            Esta acción es reversible.
          </p>
          <Button variant="outline" className="border-blue-500/50 text-blue-600 hover:bg-blue-500/10" onClick={() => setOpen(true)}>
            <Eye className="h-4 w-4 mr-1" /> Resetear Vista
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Visual</DialogTitle>
            <DialogDescription>
              Los contadores del dashboard se reiniciarán a cero. Los datos reales (ventas, reportes, historial) no se eliminan.
            </DialogDescription>
          </DialogHeader>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Solo afecta la vista</AlertTitle>
            <AlertDescription>Los reportes y el historial seguirán intactos. Puedes revertir esto cambiando el periodo del dashboard.</AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleReset} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
              Confirmar Reset Visual
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ─── Layer 2: Period Reset ─── */
function Layer2Reset() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [periodName, setPeriodName] = useState('');
  const queryClient = useQueryClient();

  const handleReset = async () => {
    if (!profile?.business_id || !periodName.trim()) return;
    setLoading(true);

    // Close active period
    await supabase
      .from('business_periods' as any)
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('business_id', profile.business_id)
      .eq('is_active', true);

    // Create new period
    const { error } = await supabase
      .from('business_periods' as any)
      .insert({
        business_id: profile.business_id,
        name: periodName.trim(),
        is_active: true,
      });

    // Also set dashboard_reset_at so indicators start fresh
    await supabase
      .from('businesses')
      .update({ dashboard_reset_at: new Date().toISOString() } as any)
      .eq('id', profile.business_id);

    setLoading(false);
    if (error) {
      toast.error('Error al cerrar el periodo');
    } else {
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success(`Periodo "${periodName}" iniciado`);
      setPeriodName('');
      setOpen(false);
    }
  };

  return (
    <>
      <Card className="border-amber-500/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <CalendarClock className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-base">Reset de Periodo</CardTitle>
              <CardDescription>Cierra el periodo actual y abre uno nuevo</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Las ventas anteriores quedan <strong>archivadas en el historial</strong> pero dejan de contar en los indicadores activos.
            Los reportes históricos siguen accesibles. Moderadamente destructivo.
          </p>
          <Button variant="outline" className="border-amber-500/50 text-amber-600 hover:bg-amber-500/10" onClick={() => setOpen(true)}>
            <CalendarClock className="h-4 w-4 mr-1" /> Cerrar Periodo
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cerrar Periodo Actual</DialogTitle>
            <DialogDescription>
              Se cerrará el periodo actual ({format(new Date(), 'dd/MM/yyyy')}) y se abrirá uno nuevo. Las ventas anteriores quedan archivadas.
            </DialogDescription>
          </DialogHeader>
          <Alert className="border-amber-500/50">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertTitle>Impacto moderado</AlertTitle>
            <AlertDescription>Los indicadores activos se reinician. El historial y reportes anteriores permanecen accesibles.</AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Label>Nombre del nuevo periodo</Label>
            <Input placeholder="Ej: Temporada 2026" value={periodName} onChange={e => setPeriodName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleReset} disabled={loading || !periodName.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CalendarClock className="h-4 w-4 mr-1" />}
              Confirmar Cierre de Periodo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ─── Layer 3: Complete Reset ─── */
function Layer3Reset() {
  const { profile, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [counting, setCounting] = useState(false);
  const [password, setPassword] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [counts, setCounts] = useState<{ sales: number; movements: number; cashMovements: number } | null>(null);
  const queryClient = useQueryClient();

  const countRecords = async () => {
    if (!profile?.business_id || !dateFrom || !dateTo) return;
    setCounting(true);
    const fromISO = new Date(dateFrom).toISOString();
    const toISO = new Date(dateTo + 'T23:59:59').toISOString();

    const [salesRes, movRes, cashRes] = await Promise.all([
      supabase.from('sales').select('id', { count: 'exact', head: true })
        .eq('branch_id', profile.branch_id!).gte('created_at', fromISO).lte('created_at', toISO),
      supabase.from('inventory_movements').select('id', { count: 'exact', head: true })
        .eq('branch_id', profile.branch_id!).gte('created_at', fromISO).lte('created_at', toISO),
      supabase.from('cash_register_movements').select('id', { count: 'exact', head: true })
        .eq('business_id', profile.business_id).gte('created_at', fromISO).lte('created_at', toISO),
    ]);

    setCounts({
      sales: salesRes.count ?? 0,
      movements: movRes.count ?? 0,
      cashMovements: cashRes.count ?? 0,
    });
    setCounting(false);
    setStep(2);
  };

  const handleDelete = async () => {
    if (!profile?.business_id || !user?.email || !password) return;
    setLoading(true);

    // Verify password
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });

    if (authError) {
      setLoading(false);
      toast.error('Contraseña incorrecta');
      return;
    }

    const fromISO = new Date(dateFrom).toISOString();
    const toISO = new Date(dateTo + 'T23:59:59').toISOString();

    // Delete sale_items first (FK), then sales, then movements
    const { data: salesData } = await supabase.from('sales').select('id')
      .eq('branch_id', profile.branch_id!).gte('created_at', fromISO).lte('created_at', toISO);

    const saleIds = (salesData || []).map(s => s.id);

    if (saleIds.length > 0) {
      await supabase.from('sale_items').delete().in('sale_id', saleIds);
      await supabase.from('sales').delete().in('id', saleIds);
    }

    await supabase.from('inventory_movements').delete()
      .eq('branch_id', profile.branch_id!).gte('created_at', fromISO).lte('created_at', toISO);

    await supabase.from('cash_register_movements').delete()
      .eq('business_id', profile.business_id).gte('created_at', fromISO).lte('created_at', toISO);

    setLoading(false);
    queryClient.invalidateQueries();
    toast.success('Datos eliminados correctamente');
    setOpen(false);
    setStep(1);
    setCounts(null);
    setPassword('');
    setDateFrom('');
    setDateTo('');
  };

  const handleClose = () => {
    setOpen(false);
    setStep(1);
    setCounts(null);
    setPassword('');
  };

  const totalRecords = counts ? counts.sales + counts.movements + counts.cashMovements : 0;

  return (
    <>
      <Card className="border-destructive/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-destructive/10 p-2">
              <Trash2 className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-base">Reset Completo</CardTitle>
              <CardDescription>Elimina datos de un rango de fechas</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Borra ventas, movimientos de caja e inventario de un rango de fechas seleccionado.
            <strong className="text-destructive"> Irreversible.</strong> Requiere contraseña del dueño.
          </p>
          <Button variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10" onClick={() => setOpen(true)}>
            <Trash2 className="h-4 w-4 mr-1" /> Reset Completo
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Reset Completo — Irreversible</DialogTitle>
            <DialogDescription>
              Selecciona el rango de fechas. Los datos eliminados no se pueden recuperar.
            </DialogDescription>
          </DialogHeader>

          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Desde</Label>
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Hasta</Label>
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleClose}>Cancelar</Button>
                <Button variant="destructive" onClick={countRecords} disabled={counting || !dateFrom || !dateTo}>
                  {counting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Contar registros
                </Button>
              </DialogFooter>
            </>
          )}

          {step === 2 && counts && (
            <>
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Esta operación NO tiene vuelta atrás</AlertTitle>
                <AlertDescription>
                  Se eliminarán permanentemente:
                  <ul className="mt-2 list-disc pl-4 space-y-1">
                    <li><strong>{counts.sales}</strong> ventas</li>
                    <li><strong>{counts.movements}</strong> movimientos de inventario</li>
                    <li><strong>{counts.cashMovements}</strong> movimientos de caja</li>
                  </ul>
                  <p className="mt-2 font-semibold">Total: {totalRecords} registros</p>
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label>Confirma tu contraseña</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña del dueño" />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setStep(1); setCounts(null); }}>Volver</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={loading || !password || totalRecords === 0}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                  Eliminar {totalRecords} registros
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ─── Main Export ─── */
export default function DataManagement() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Gestión de Datos</h3>
        <p className="text-sm text-muted-foreground">
          Controla los indicadores y datos de tu negocio. Cada nivel tiene un impacto diferente.
        </p>
      </div>
      <Layer1Reset />
      <Layer2Reset />
      <Layer3Reset />
    </div>
  );
}
