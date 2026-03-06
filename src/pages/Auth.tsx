import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Chrome, Apple, ArrowRight, ArrowLeft, Mail, Lock, User, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { z } from "zod";
import logoLight from "@/assets/logo-light.png";
import logoDark from "@/assets/logo-dark.png";

const emailSchema = z.string().email("Email inválido");
const passwordSchema = z.string().min(6, "La contraseña debe tener al menos 6 caracteres");
const nameSchema = z.string().min(2, "El nombre debe tener al menos 2 caracteres");

type Step = "email" | "password" | "signup";

const Auth = () => {
  const navigate = useNavigate();
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("email");
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  useEffect(() => {
    const msg = sessionStorage.getItem("auth_message");
    if (msg) {
      sessionStorage.removeItem("auth_message");
      toast({ title: "Aviso", description: msg, variant: "destructive" });
    }
  }, []);

  const isAffiliateFlow = !!sessionStorage.getItem("affiliate_branch_id");

  useEffect(() => {
    if (!authLoading && user) {
      const affiliateRedirect = sessionStorage.getItem("affiliate_redirect");
      const affiliateBranchId = sessionStorage.getItem("affiliate_branch_id");

      if (affiliateRedirect && affiliateBranchId) {
        const doAffiliate = async () => {
          try {
            await supabase.functions.invoke("affiliate-join", {
              body: { branch_id: affiliateBranchId },
            });
          } catch {
            // silent
          }
          sessionStorage.removeItem("affiliate_redirect");
          sessionStorage.removeItem("affiliate_branch_id");
          navigate(affiliateRedirect);
        };
        doAffiliate();
        return;
      }
      navigate("/");
    }
  }, [user, authLoading, navigate]);

  const handleEmailContinue = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(email);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({ title: "Error", description: err.errors[0].message, variant: "destructive" });
        return;
      }
    }
    setStep("password");
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({ title: "Error", description: err.errors[0].message, variant: "destructive" });
        return;
      }
    }

    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        setStep("signup");
        toast({
          title: "Cuenta no encontrada",
          description: "No encontramos una cuenta con esas credenciales. Completa los datos para crear una.",
        });
      } else if (error.message.includes("Email not confirmed")) {
        toast({ title: "Email no confirmado", description: "Revisa tu bandeja de entrada para confirmar tu cuenta.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: "Error al iniciar sesión", variant: "destructive" });
      }
    } else {
      toast({ title: "¡Bienvenido!", description: "Has iniciado sesión correctamente." });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      nameSchema.parse(signupName);
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({ title: "Error", description: err.errors[0].message, variant: "destructive" });
        return;
      }
    }
    if (password !== signupConfirmPassword) {
      toast({ title: "Error", description: "Las contraseñas no coinciden", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(email, password, signupName);
    setIsLoading(false);

    if (error) {
      let message = "Error al crear la cuenta";
      if (error.message.includes("already registered")) {
        message = "Este email ya está registrado. Intenta iniciar sesión.";
        setStep("password");
      }
      toast({ title: "Error", description: message, variant: "destructive" });
    } else {
      toast({ title: "¡Cuenta creada!", description: "Revisa tu email para confirmar tu cuenta." });
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
      extraParams: { prompt: "select_account" },
    });
    if (error) {
      toast({ title: "Error", description: "No se pudo iniciar sesión con Google.", variant: "destructive" });
    }
    setGoogleLoading(false);
  };

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    const { error } = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast({ title: "Error", description: "No se pudo iniciar sesión con Apple.", variant: "destructive" });
    }
    setAppleLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md overflow-hidden">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {isAffiliateFlow ? "Únete como Afiliado" : "Bienvenido"}
          </CardTitle>
          <CardDescription>
            {step === "email" && "Ingresa tu email para continuar"}
            {step === "password" && "Ingresa tu contraseña"}
            {step === "signup" && "Completa tus datos para crear tu cuenta"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step: Email */}
          {step === "email" && (
            <>
              <div className="space-y-3">
                <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={googleLoading}>
                  {googleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Chrome className="mr-2 h-4 w-4" />}
                  Continuar con Google
                </Button>
                <Button variant="outline" className="w-full" onClick={handleAppleSignIn} disabled={appleLoading}>
                  {appleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Apple className="mr-2 h-4 w-4" />}
                  Continuar con Apple
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">o con email</span>
                </div>
              </div>

              <form onSubmit={handleEmailContinue} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="tu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full gap-2">
                  Continuar <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}

          {/* Step: Password (login attempt) */}
          {step === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{email}</span>
                <button
                  type="button"
                  onClick={() => { setStep("email"); setPassword(""); }}
                  className="ml-auto text-xs text-primary hover:underline shrink-0"
                >
                  Cambiar
                </button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Iniciar sesión <ArrowRight className="h-4 w-4" />
              </Button>

              <button
                type="button"
                onClick={() => { setStep("email"); setPassword(""); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mx-auto"
              >
                <ArrowLeft className="h-3 w-3" /> Volver
              </button>
            </form>
          )}

          {/* Step: Signup (after failed login) */}
          {step === "signup" && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{email}</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-name" className="text-sm">Nombre completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Tu nombre"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    className="pl-10"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password" className="text-sm">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-confirm" className="text-sm">Confirmar contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-confirm"
                    type="password"
                    placeholder="••••••••"
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Crear cuenta
              </Button>

              <button
                type="button"
                onClick={() => { setStep("password"); setSignupName(""); setSignupConfirmPassword(""); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mx-auto"
              >
                <ArrowLeft className="h-3 w-3" /> Ya tengo cuenta
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
