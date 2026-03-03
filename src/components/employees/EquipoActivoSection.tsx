import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { autoOpenCaja } from '@/lib/autoOpenCaja';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Users, Play, Loader2 } from 'lucide-react';

interface EmployeeWithJornada {
  id: string;
  full_name: string;
  email: string | null;
  branch_id: string | null;
  position: string;
  profileId: string | null;
  jornada: any | null;
}

const ElapsedBadge = ({ aperturaAt }: { aperturaAt: string }) => {
  const [text, setText] = useState('');
  useEffect(() => {
    const update = () => {
      const m = Math.floor((Date.now() - new Date(aperturaAt).getTime()) / 60000);
      const h = Math.floor(m / 60);
      setText(h > 0 ? `${h}h ${m % 60}m` : `${m}m`);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [aperturaAt]);

  return (
    <Badge variant="outline" className="border-primary/30 text-primary text-[10px] gap-1">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
      </span>
      Activa · {text}
    </Badge>
  );
};

interface EquipoActivoProps {
  onlyActive?: boolean;
  /** Override business ID (e.g. employer's business for Mi Empleo context) */
  businessIdOverride?: string;
  /** Show personal jornada info inline */
  myJornada?: { apertura_at: string } | null;
  jornadaActiva?: boolean;
}

const EquipoActivoSection = ({ onlyActive = false, businessIdOverride, myJornada, jornadaActiva: myJornadaActiva }: EquipoActivoProps) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const businessId = businessIdOverride || profile?.business_id;

  const [iniciarDialog, setIniciarDialog] = useState<{ profileId: string; name: string; branchId: string | null } | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch HR employees + match profiles + active jornadas
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['equipo-activo', businessId],
    queryFn: async () => {
      if (!businessId) return [];

      // 1. Get all HR employees for this business
      const { data: employees } = await supabase
        .from('employees')
        .select('id, full_name, email, branch_id, position')
        .eq('business_id', businessId);
      if (!employees?.length) return [];

      // 2. Get profiles by email using SECURITY DEFINER function
      const emails = employees.filter(e => e.email).map(e => e.email!.toLowerCase());
      let profileMap: Record<string, { id: string; branch_id: string | null }> = {};
      if (emails.length > 0) {
        const { data: profiles } = await supabase.rpc('get_profiles_by_emails', { emails });
        if (profiles) {
          for (const p of profiles) {
            profileMap[p.email.toLowerCase()] = { id: p.id, branch_id: p.branch_id };
          }
        }
      }

      // 3. Get active jornadas for business branches
      const { data: branches } = await supabase
        .from('branches')
        .select('id')
        .eq('business_id', businessId);
      const branchIds = branches?.map(b => b.id) || [];

      let jornadas: any[] = [];
      if (branchIds.length > 0) {
        const { data } = await supabase
          .from('jornadas')
          .select('*')
          .in('sucursal_id', branchIds)
          .is('cierre_at', null);
        jornadas = data || [];
      }

      // 4. Combine
      return employees.map(emp => {
        const prof = emp.email ? profileMap[emp.email.toLowerCase()] : null;
        return {
          id: emp.id,
          full_name: emp.full_name,
          email: emp.email,
          branch_id: emp.branch_id,
          position: emp.position,
          profileId: prof?.id || null,
          jornada: prof ? jornadas.find(j => j.empleado_id === prof.id) || null : null,
        } as EmployeeWithJornada;
      });
    },
    enabled: !!businessId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!businessId) return;
    const channel = supabase
      .channel('jornadas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, () => {
        queryClient.invalidateQueries({ queryKey: ['equipo-activo', businessId] });
        queryClient.invalidateQueries({ queryKey: ['jornadas-activas-business', businessId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [businessId, queryClient]);

  const handleIniciarJornada = async () => {
    if (!iniciarDialog) return;
    const branchId = iniciarDialog.branchId || profile?.branch_id;
    if (!branchId) {
      toast.error('No se puede determinar la sucursal');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('jornadas').insert({
      empleado_id: iniciarDialog.profileId,
      sucursal_id: branchId,
      metodo_apertura: 'manual_gerente',
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      // Auto-open caja
      try {
        // Resolve auth user_id from profile id
        const { data: profData } = await supabase
          .from('profiles')
          .select('user_id, business_id')
          .eq('id', iniciarDialog.profileId)
          .single();
        if (profData) {
          let bizId = profData.business_id || profile?.business_id;
          if (!bizId) {
            // Resolve from employees table for @bivoo.app users
            const { data: empRec } = await supabase
              .from('employees')
              .select('business_id')
              .eq('auth_user_id', profData.user_id)
              .maybeSingle();
            bizId = empRec?.business_id || null;
          }
          if (bizId) {
            await autoOpenCaja({ userId: profData.user_id, branchId, businessId: bizId });
          }
        }
      } catch (e) {
        console.error('Auto-open caja failed:', e);
      }
      toast.success(`Jornada iniciada para ${iniciarDialog.name}`);
      queryClient.invalidateQueries({ queryKey: ['equipo-activo'] });
      queryClient.invalidateQueries({ queryKey: ['jornadas-activas-business'] });
      queryClient.invalidateQueries({ queryKey: ['active-cash-register'] });
      queryClient.invalidateQueries({ queryKey: ['owner-open-registers'] });
      setIniciarDialog(null);
    }
  };

  const initials = (name: string) => name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const activos = members.filter(m => m.jornada);
  const inactivos = onlyActive ? [] : members.filter(m => !m.jornada);
  const displayMembers = [...activos, ...inactivos];

  if (onlyActive && activos.length === 0 && !isLoading && !myJornadaActiva) return null;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            Equipo activo ahora
            {activos.length > 0 && (
              <Badge variant="secondary" className="text-[10px] ml-1">{activos.length}</Badge>
            )}
          </CardTitle>
          {/* Personal jornada status */}
          {myJornadaActiva && myJornada ? (
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="border-primary/30 text-primary gap-1.5 text-[10px] py-0.5 px-2">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                </span>
                Tu jornada activa
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                Desde {new Date(myJornada.apertura_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ) : myJornadaActiva === false ? (
            <div className="flex items-center gap-1.5 mt-1">
              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
              <span className="text-[10px] text-muted-foreground">Sin jornada activa</span>
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          {displayMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {onlyActive ? 'Ningún empleado activo' : 'No hay empleados registrados'}
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {displayMembers.map(m => (
                <div
                  key={m.id}
                  className={`rounded-lg border p-3 space-y-2 transition-colors ${
                    m.jornada ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
                      {initials(m.full_name)}
                    </div>
                    <span className="text-xs font-medium truncate">{m.full_name}</span>
                  </div>
                  {m.jornada ? (
                    <ElapsedBadge aperturaAt={m.jornada.apertura_at} />
                  ) : (
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">Sin jornada</Badge>
                      {m.profileId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setIniciarDialog({ profileId: m.profileId!, name: m.full_name, branchId: m.branch_id })}
                          title="Iniciar jornada"
                        >
                          <Play className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {members.length > 0 && activos.length === 0 && (
            <p className="text-xs text-muted-foreground text-center mt-2">Ningún empleado tiene jornada activa</p>
          )}
        </CardContent>
      </Card>

      {/* Dialog iniciar jornada manual */}
      <Dialog open={!!iniciarDialog} onOpenChange={o => { if (!o) setIniciarDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Iniciar jornada</DialogTitle>
            <DialogDescription>
              ¿Iniciar jornada laboral para <strong>{iniciarDialog?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIniciarDialog(null)}>Cancelar</Button>
            <Button onClick={handleIniciarJornada} disabled={saving}>
              {saving ? 'Iniciando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EquipoActivoSection;
