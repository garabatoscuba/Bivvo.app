import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, CheckCircle, AlertTriangle, LogIn, Clock } from 'lucide-react';
import { toast } from 'sonner';

type Step = 'loading' | 'invalid' | 'login' | 'error' | 'confirm' | 'success';

const JornadaEntrada = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const auditLog = useAuditLog();

  const sucursalId = searchParams.get('sucursal');

  const [step, setStep] = useState<Step>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [branchName, setBranchName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Validate sucursal param
  useEffect(() => {
    if (!sucursalId) {
      setStep('invalid');
      setErrorMsg('QR inválido. No se encontró información de sucursal.');
      return;
    }

    const validateBranch = async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .eq('id', sucursalId)
        .maybeSingle();

      if (error || !data) {
        setStep('invalid');
        setErrorMsg('Sucursal no encontrada. Verifica que el QR sea válido.');
        return;
      }

      setBranchName(data.name);

      // If user not logged in, show login
      if (!user || !profile) {
        setStep('login');
        return;
      }

      // User is logged in — validate assignment and existing jornada
      await validateAndPrepare(data.id);
    };

    validateBranch();
  }, [sucursalId, user, profile]);

  const validateAndPrepare = async (branchId: string) => {
    if (!profile) return;

    // Check branch assignment
    const isAssigned = profile.branch_id === branchId;
    if (!isAssigned) {
      // Check employee_branch_assignments
      const { data: assignments } = await supabase
        .from('employee_branch_assignments')
        .select('id')
        .eq('employee_id', profile.id)
        .eq('branch_id', branchId)
        .limit(1);

      if (!assignments || assignments.length === 0) {
        setStep('error');
        setErrorMsg('No estás asignado a esta sucursal. Contacta a tu gerente.');
        return;
      }
    }

    // Check existing active jornada
    const { data: activeJornada } = await supabase
      .from('jornadas')
      .select('id')
      .eq('empleado_id', profile.id)
      .is('cierre_at', null)
      .limit(1);

    if (activeJornada && activeJornada.length > 0) {
      setStep('error');
      setErrorMsg('Ya tienes una jornada activa. Ciérrala primero antes de iniciar una nueva.');
      return;
    }

    setStep('confirm');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoginLoading(false);
    if (error) {
      toast.error('Credenciales incorrectas');
      return;
    }
    // Auth state change will trigger useEffect to re-validate
    setStep('loading');
  };

  const handleConfirm = async () => {
    if (!profile || !sucursalId) return;
    setSubmitting(true);

    const { error } = await supabase.from('jornadas').insert({
      empleado_id: profile.id,
      sucursal_id: sucursalId,
      metodo_apertura: 'qr',
    });

    setSubmitting(false);
    if (error) {
      toast.error('Error al iniciar jornada: ' + error.message);
      return;
    }

    setStep('success');
    toast.success('¡Jornada iniciada! Bienvenido 👋');
    setTimeout(() => navigate('/'), 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        {step === 'loading' && (
          <CardContent className="flex flex-col items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Verificando...</p>
          </CardContent>
        )}

        {(step === 'invalid' || step === 'error') && (
          <>
            <CardHeader className="items-center text-center">
              <div className="rounded-full bg-destructive/10 p-3 mb-2">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-lg">Error</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
              <Button variant="outline" onClick={() => navigate('/')} className="w-full">
                Ir al inicio
              </Button>
            </CardContent>
          </>
        )}

        {step === 'login' && (
          <>
            <CardHeader className="items-center text-center">
              <div className="rounded-full bg-primary/10 p-3 mb-2">
                <LogIn className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-lg">Iniciar sesión</CardTitle>
              <CardDescription>Ingresa tus credenciales para registrar tu entrada en <strong>{branchName}</strong></CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full gap-2" disabled={loginLoading}>
                  {loginLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Iniciar sesión
                </Button>
              </form>
            </CardContent>
          </>
        )}

        {step === 'confirm' && (
          <>
            <CardHeader className="items-center text-center">
              <div className="rounded-full bg-primary/10 p-3 mb-2">
                <Clock className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-lg">Confirmar entrada</CardTitle>
              <CardDescription>
                Vas a registrar tu entrada en <strong>{branchName}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4 text-center space-y-1">
                <p className="text-sm text-muted-foreground">Empleado</p>
                <p className="font-semibold">{profile?.full_name}</p>
                <p className="text-sm text-muted-foreground mt-2">Hora actual</p>
                <p className="text-2xl font-bold tabular-nums">
                  {new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <Button onClick={handleConfirm} className="w-full h-12 text-base gap-2" disabled={submitting}>
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                Confirmar entrada
              </Button>
            </CardContent>
          </>
        )}

        {step === 'success' && (
          <CardContent className="flex flex-col items-center py-12">
            <div className="rounded-full bg-primary/10 p-3 mb-3">
              <CheckCircle className="h-10 w-10 text-primary" />
            </div>
            <p className="text-lg font-semibold">¡Jornada iniciada!</p>
            <p className="text-sm text-muted-foreground">Redirigiendo...</p>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default JornadaEntrada;
