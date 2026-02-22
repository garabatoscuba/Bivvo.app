import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, CheckCircle, AlertTriangle, LogIn, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';

type Step = 'loading' | 'invalid' | 'auth' | 'confirm' | 'processing' | 'success' | 'error';

const OnboardingEmpleado = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile, user } = useAuth();

  const token = searchParams.get('token');

  const [step, setStep] = useState<Step>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const [employeeName, setEmployeeName] = useState('');
  const [businessName, setBusinessName] = useState('');

  // Auth form
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Validate token
  useEffect(() => {
    if (!token) {
      setStep('invalid');
      setErrorMsg('Enlace inválido. No se encontró token de invitación.');
      return;
    }

    const validateToken = async () => {
      const { data, error } = await supabase
        .from('employee_onboarding_tokens')
        .select('*, employees(full_name), businesses(name)')
        .eq('token', token)
        .is('used_at', null)
        .maybeSingle();

      if (error || !data) {
        setStep('invalid');
        setErrorMsg('Invitación inválida o ya utilizada.');
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setStep('invalid');
        setErrorMsg('Esta invitación ha expirado. Solicita una nueva a tu gerente.');
        return;
      }

      setTokenInfo(data);
      setEmployeeName((data as any).employees?.full_name || '');
      setBusinessName((data as any).businesses?.name || '');
      setFullName((data as any).employees?.full_name || '');

      if (!user || !profile) {
        setStep('auth');
      } else {
        setStep('confirm');
      }
    };

    validateToken();
  }, [token, user, profile]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);

    if (authMode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setAuthLoading(false);
      if (error) {
        toast.error('Credenciales incorrectas');
        return;
      }
      setStep('loading');
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding/empleado?token=${token}`,
          data: { full_name: fullName },
        },
      });
      setAuthLoading(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      // After signup, auth state change will trigger re-check
      setStep('loading');
    }
  };

  const handleConfirm = async () => {
    if (!token) return;
    setStep('processing');

    try {
      const { data, error } = await supabase.functions.invoke('employee-onboarding', {
        body: { token },
      });

      if (error || data?.error) {
        setStep('error');
        setErrorMsg(data?.error || error?.message || 'Error al procesar la invitación');
        return;
      }

      setStep('success');
      toast.success('¡Bienvenido al equipo! 🎉');
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (err: any) {
      setStep('error');
      setErrorMsg(err.message || 'Error inesperado');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        {step === 'loading' && (
          <CardContent className="flex flex-col items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Verificando invitación...</p>
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

        {step === 'auth' && (
          <>
            <CardHeader className="items-center text-center">
              <div className="rounded-full bg-primary/10 p-3 mb-2">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-lg">
                {authMode === 'register' ? 'Únete al equipo' : 'Inicia sesión'}
              </CardTitle>
              <CardDescription>
                {businessName && (
                  <span>
                    Has sido invitado a <strong>{businessName}</strong>
                    {employeeName && <> como <strong>{employeeName}</strong></>}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAuth} className="space-y-4">
                {authMode === 'register' && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nombre completo</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      required
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus={authMode === 'login'}
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
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full gap-2" disabled={authLoading}>
                  {authLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {authMode === 'register' ? (
                    <><UserPlus className="h-4 w-4" /> Crear cuenta</>
                  ) : (
                    <><LogIn className="h-4 w-4" /> Iniciar sesión</>
                  )}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  {authMode === 'register' ? (
                    <>¿Ya tienes cuenta?{' '}
                      <button type="button" onClick={() => setAuthMode('login')} className="text-primary underline">
                        Inicia sesión
                      </button>
                    </>
                  ) : (
                    <>¿No tienes cuenta?{' '}
                      <button type="button" onClick={() => setAuthMode('register')} className="text-primary underline">
                        Regístrate
                      </button>
                    </>
                  )}
                </p>
              </form>
            </CardContent>
          </>
        )}

        {step === 'confirm' && (
          <>
            <CardHeader className="items-center text-center">
              <div className="rounded-full bg-primary/10 p-3 mb-2">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-lg">Confirmar vinculación</CardTitle>
              <CardDescription>
                Vas a unirte como empleado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4 text-center space-y-2">
                {businessName && (
                  <div>
                    <p className="text-xs text-muted-foreground">Negocio</p>
                    <p className="font-semibold">{businessName}</p>
                  </div>
                )}
                {employeeName && (
                  <div>
                    <p className="text-xs text-muted-foreground">Empleado</p>
                    <p className="font-semibold">{employeeName}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Tu cuenta</p>
                  <p className="font-medium text-sm">{profile?.full_name} ({profile?.email})</p>
                </div>
              </div>
              <Button onClick={handleConfirm} className="w-full h-12 text-base gap-2">
                <CheckCircle className="h-5 w-5" />
                Unirme al equipo
              </Button>
            </CardContent>
          </>
        )}

        {step === 'processing' && (
          <CardContent className="flex flex-col items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Configurando tu acceso...</p>
          </CardContent>
        )}

        {step === 'success' && (
          <CardContent className="flex flex-col items-center py-12">
            <div className="rounded-full bg-primary/10 p-3 mb-3">
              <CheckCircle className="h-10 w-10 text-primary" />
            </div>
            <p className="text-lg font-semibold">¡Bienvenido al equipo!</p>
            <p className="text-sm text-muted-foreground">Redirigiendo al sistema...</p>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default OnboardingEmpleado;
