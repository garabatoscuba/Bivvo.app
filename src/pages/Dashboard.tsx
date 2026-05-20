import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { type Period } from '@/components/ui/period-filter';
import { useSubscription } from '@/hooks/useSubscription';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button as DialogButton } from '@/components/ui/button';
import { ShoppingCart } from 'lucide-react';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import EasyDashboard from '@/components/dashboard/easy/EasyDashboard';

const Dashboard = () => {
  const { profile, isAffiliated, isOwner, isManager, isSuperAdmin, isBivooAccount } = useAuth();
  const { planType, status: subStatus, totalMonthly } = useSubscription();

  const navigate = useNavigate();
  const isEmployee = !isOwner && !isManager && !isSuperAdmin;

  // Redirect employees to Mi Empleo — they don't see the owner dashboard
  useEffect(() => {
    if (isEmployee || isBivooAccount) {
      navigate('/mi-empleo', { replace: true });
    }
  }, [isEmployee, isBivooAccount, navigate]);

  const [period, setPeriod] = useState<Period>('today');
  const [planInfoPopupOpen, setPlanInfoPopupOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  // Show welcome dialog for first-time OWNER users only (never for employees)
  useEffect(() => {
    if (!profile?.user_id) return;
    if (isEmployee || isBivooAccount) return;
    if (!profile.country || !(profile as any).onboarding_completed) {
      setShowWelcome(true);
    }
  }, [profile?.user_id, profile?.country, (profile as any)?.onboarding_completed, isEmployee, isBivooAccount]);

  const planNoticeStorageKey = profile?.user_id ? `bivoo-plan-notice-${profile.user_id}` : null;
  const planNoticeValue = `${planType}:${profile?.subscription_status || 'none'}`;

  useEffect(() => {
    if (!planNoticeStorageKey) return;
    if (isEmployee || isBivooAccount) return;
    if (planType === 'free' || subStatus === 'blocked') return;

    const alreadySeen = localStorage.getItem(planNoticeStorageKey);
    if (alreadySeen !== planNoticeValue) {
      setPlanInfoPopupOpen(true);
    }
  }, [planNoticeStorageKey, planNoticeValue, planType, subStatus, isEmployee, isBivooAccount]);

  const handleClosePlanInfo = () => {
    if (planNoticeStorageKey) {
      localStorage.setItem(planNoticeStorageKey, planNoticeValue);
    }
    setPlanInfoPopupOpen(false);
  };

  const planLabel = planType === 'enterprise' ? 'Enterprise' : planType === 'professional' ? 'Profesional' : 'Gratuito';

  if (isAffiliated) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              ¡Hola, {profile?.full_name?.split(' ')[0]}!
            </h1>
            <p className="text-muted-foreground max-w-md">
              Actualmente eres cliente afiliado. Puedes acumular puntos en las tiendas donde te has registrado.
            </p>
          </div>
          <Card className="max-w-sm w-full">
            <CardHeader className="text-center">
              <CardTitle className="text-lg">¿Tienes un negocio?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Gestiona tu inventario, ventas, empleados y más desde un solo lugar con GestorPro.
              </p>
              <Link to="/plans">
                <DialogButton className="w-full">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Crear mi negocio
                </DialogButton>
              </Link>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const businessName = (profile as any)?.business_name || 'Mi negocio';

  return (
    <AppLayout hideHeader noPadding>
      <EasyDashboard
        period={period}
        onPeriodChange={setPeriod}
        businessName={businessName}
      />

      {showWelcome && profile && (
        <OnboardingWizard
          open={showWelcome}
          profile={{
            user_id: profile.user_id,
            business_id: profile.business_id,
            country: profile.country,
          }}
        />
      )}

      <Dialog
        open={planInfoPopupOpen}
        onOpenChange={(open) => {
          if (open) {
            setPlanInfoPopupOpen(true);
          } else {
            handleClosePlanInfo();
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>🎉 ¡Tu plan está activo!</DialogTitle>
            <DialogDescription>
              Conservamos el nombre y el tipo de negocio que configuraste en tus primeros pasos.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium">{planLabel}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Estado</span>
              <span className="font-medium">{subStatus === 'trial' ? 'Prueba activa' : 'Activo'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total mensual</span>
              <span className="font-medium">${totalMonthly} USD</span>
            </div>
          </div>

          <DialogFooter>
            <DialogButton className="w-full" onClick={handleClosePlanInfo}>
              Entendido
            </DialogButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Dashboard;
