import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Chrome, Apple } from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().email("Email inválido");
const passwordSchema = z.string().min(6, "La contraseña debe tener al menos 6 caracteres");
const nameSchema = z.string().min(2, "El nombre debe tener al menos 2 caracteres");

const Auth = () => {
  const navigate = useNavigate();
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      emailSchema.parse(loginEmail);
      passwordSchema.parse(loginPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          title: "Error de validación",
          description: err.errors[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsLoading(false);

    if (error) {
      let message = "Error al iniciar sesión";
      if (error.message.includes("Invalid login credentials")) {
        message = "Credenciales inválidas. Verifica tu email y contraseña.";
      } else if (error.message.includes("Email not confirmed")) {
        message = "Por favor confirma tu email antes de iniciar sesión.";
      }
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "¡Bienvenido!",
        description: "Has iniciado sesión correctamente.",
      });
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast({
        title: "Error",
        description: "No se pudo iniciar sesión con Google. Intenta de nuevo.",
        variant: "destructive",
      });
    }
    setGoogleLoading(false);
  };

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    const { error } = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast({
        title: "Error",
        description: "No se pudo iniciar sesión con Apple. Intenta de nuevo.",
        variant: "destructive",
      });
    }
    setAppleLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      nameSchema.parse(signupName);
      emailSchema.parse(signupEmail);
      passwordSchema.parse(signupPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          title: "Error de validación",
          description: err.errors[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    if (signupPassword !== signupConfirmPassword) {
      toast({
        title: "Error",
        description: "Las contraseñas no coinciden",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(signupEmail, signupPassword, signupName);
    setIsLoading(false);

    if (error) {
      let message = "Error al crear la cuenta";
      if (error.message.includes("already registered")) {
        message = "Este email ya está registrado.";
      }
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "¡Cuenta creada!",
        description: "Revisa tu email para confirmar tu cuenta.",
      });
    }
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
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">{isAffiliateFlow ? "Únete como Afiliado" : "Bienvenido"}</CardTitle>
          <CardDescription>
            {isAffiliateFlow
              ? "Crea una cuenta o inicia sesión para completar tu afiliación"
              : "Inicia sesión o crea una cuenta"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 mb-6">
            <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={googleLoading}>
              {googleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Chrome className="mr-2 h-4 w-4" />}
              Continuar con Google
            </Button>
            <Button variant="outline" className="w-full" onClick={handleAppleSignIn} disabled={appleLoading}>
              {appleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Apple className="mr-2 h-4 w-4" />}
              Continuar con Apple
            </Button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">o con email</span>
            </div>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
              <TabsTrigger value="signup">Registrarse</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="tu@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Contraseña</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Iniciar Sesión
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Nombre completo</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Tu nombre"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="tu@email.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Contraseña</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm">Confirmar contraseña</Label>
                  <Input
                    id="signup-confirm"
                    type="password"
                    placeholder="••••••••"
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Crear Cuenta
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
