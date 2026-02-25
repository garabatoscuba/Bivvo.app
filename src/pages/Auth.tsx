import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Chrome, Apple } from 'lucide-react';
import { z } from 'zod';
import { lovable } from '@/integrations/lovable/index';

const emailSchema = z.string().email('Email inválido');
const passwordSchema = z.string().min(6, 'La contraseña debe tener al menos 6 caracteres');
const nameSchema = z.string().min(2, 'El nombre debe tener al menos 2 caracteres');

const Auth = () => {
  const navigate = useNavigate();
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  // Show message from redirected auth issues
  useEffect(() => {
    const msg = sessionStorage.getItem('auth_message');
    if (msg) {
      sessionStorage.removeItem('auth_message');
      toast({ title: 'Aviso', description: msg, variant: 'destructive' });
    }
  }, []);

  const isAffiliateFlow = !!sessionStorage.getItem('affiliate_branch_id');

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && user) {
      const affiliateRedirect = sessionStorage.getItem('affiliate_redirect');
      const affiliateBranchId = sessionStorage.getItem('affiliate_branch_id');

      if (affiliateRedirect && affiliateBranchId) {
        const doAffiliate = async () => {
          try {
            await supabase.functions.invoke('affiliate-join', {
              body: { branch_id: affiliateBranchId },
            });
          } catch {
            // silent
          }
          sessionStorage.removeItem('affiliate_redirect');
          sessionStorage.removeItem('affiliate_branch_id');
          navigate(affiliateRedirect);
        };
        doAffiliate();
        return;
      }
      navigate('/');
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
          title: 'Error de validación',
          description: err.errors[0].message,
          variant: 'destructive'
        });
        return;
      }
    }

    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsLoading(false);

    if (error) {
      let message = 'Error al iniciar sesión';
      if (error.message.includes('Invalid login credentials')) {
        message = 'Credenciales inválidas. Verifica tu email y contraseña.';
      } else if (error.message.includes('Email not confirmed')) {
        message = 'Por favor confirma tu email antes de iniciar sesión.';
      }
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
    } else {
      toast({
        title: '¡Bienvenido!',
        description: 'Has iniciado sesión correctamente.'
      });
      // Redirect is handled by the useEffect above
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast({ title: 'Error', description: 'No se pudo iniciar sesión con Google. Intenta de nuevo.', variant: 'destructive' });
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    const { error } = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast({ title: 'Error', description: 'No se pudo iniciar sesión con Apple. Intenta de nuevo.', variant: 'destructive' });
      setAppleLoading(false);
    }
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
          title: 'Error de validación',
          description: err.errors[0].message,
          variant: 'destructive'
        });
        return;
      }
    }

    if (signupPassword !== signupConfirmPassword) {
      toast({
        title: 'Error',
        description: 'Las contraseñas no coinciden',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(signupEmail, signupPassword, signupName);
    setIsLoading(false);

    if (error) {
      let message = 'Error al crear la cuenta';
      if (error.message.includes('already registered')) {
        message = 'Este email ya está registrado.';
      }
      toast({
        tit
