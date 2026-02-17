import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Crown, MessageCircle, Clock, CalendarDays, Building2, DollarSign } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/contexts/AuthContext';
import { useBranches } from '@/hooks/useBranches';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const WHATSAPP_NUMBER = '53552514878';
const WHATSAPP_URL = (msg: string) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
const PLAN_PRICE = 10;
const BRANCH_PRICE = 10;

const Plans = () => {
  const { status, daysLeft, planType, trialEndsAt, subscriptionEndsAt } = useSubscription();
  const { data: branches = [] } = useBranches();

  const extraBranches = Math.max(0, branches.length - 1);
  const branchCost = extraBranches * BRANCH_PRICE;
  const totalMonthly = PLAN_PRICE + branchCost;

  const expirationDate = subscriptionEndsAt || trialEndsAt;

  const features = [
    'Punto de Venta (POS)',
    'Gestión de Inventario',
    'Registro de Empleados',
    'Reportes y Estadísticas',
    '1 Sucursal incluida',
    'Soporte por WhatsApp',
  ];

  return (
    <AppLayout title="Planes y Precios">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Mini Dashboard - Resumen de cuenta */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Resumen de tu cuenta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Plan */}
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground">Plan actual</p>
                <p className="mt-1 text-lg font-semibold">{planType === 'mvp' ? 'Profesional' : 'Prueba Gratuita'}</p>
              </div>

              {/* Days left / expiration */}
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground">
                  {status === 'blocked' ? 'Estado' : 'Vence'}
                </p>
                {status === 'blocked' ? (
                  <p className="mt-1 text-lg font-semibold text-destructive">Expirado</p>
                ) : (
                  <div className="mt-1">
                    <p className="text-lg font-semibold">{daysLeft} día{daysLeft !== 1 ? 's' : ''}</p>
                    {expirationDate && (
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(expirationDate), "d 'de' MMM yyyy", { locale: es })}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Branches */}
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Sucursales
                </p>
                <p className="mt-1 text-lg font-semibold">{branches.length}</p>
                {extraBranches > 0 && (
                  <p className="text-xs text-muted-foreground">{extraBranches} extra (+${branchCost}/mes)</p>
                )}
              </div>

              {/* Monthly total */}
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> Total mensual
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {planType === 'trial' ? '$0' : `$${totalMonthly}`}
                </p>
                {planType !== 'trial' && extraBranches > 0 && (
                  <p className="text-xs text-muted-foreground">${PLAN_PRICE} plan + ${branchCost} sucursales</p>
                )}
              </div>
            </div>

            {(status === 'blocked' || status === 'expiring') && (
              <div className="mt-4 flex justify-center">
                <Button asChild className="gap-2">
                  <a href={WHATSAPP_URL(`Hola, quiero renovar mi plan de GestorPro. Tengo ${branches.length} sucursal(es). Total: $${totalMonthly}/mes`)} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4" /> Renovar por WhatsApp
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plan cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Trial */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg">Prueba Gratuita</CardTitle>
              <CardDescription>Explora todas las funciones</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <p className="text-3xl font-bold">$0</p>
              <p className="text-sm text-muted-foreground">14 días, acceso completo</p>
              <ul className="mt-4 space-y-2">
                {features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-success shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              {planType === 'trial' ? (
                <Badge variant="outline" className="w-full justify-center py-2">Plan actual</Badge>
              ) : (
                <span className="w-full text-center text-xs text-muted-foreground">Solo para nuevos usuarios</span>
              )}
            </CardFooter>
          </Card>

          {/* Profesional */}
          <Card className="flex flex-col border-primary relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="gap-1"><Crown className="h-3 w-3" /> Recomendado</Badge>
            </div>
            <CardHeader className="pt-8">
              <CardTitle className="text-lg">Plan Profesional</CardTitle>
              <CardDescription>Todo lo que necesitas</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <p className="text-3xl font-bold">$10 <span className="text-sm font-normal text-muted-foreground">USD/mes</span></p>
              <p className="text-sm text-muted-foreground">Por negocio · Sucursales extra +$10 c/u</p>
              <ul className="mt-4 space-y-2">
                {features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-success shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              {planType === 'mvp' && status === 'active' ? (
                <Badge variant="outline" className="w-full justify-center py-2">Plan actual</Badge>
              ) : (
                <Button asChild className="w-full gap-2">
                  <a href={WHATSAPP_URL('Hola, quiero activar el Plan Profesional de GestorPro')} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4" /> Activar por WhatsApp
                  </a>
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>

        {/* WhatsApp CTA */}
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <MessageCircle className="h-10 w-10" />
            <h3 className="text-xl font-semibold">¿Tienes dudas? Escríbenos</h3>
            <p className="text-sm opacity-90">Estamos disponibles por WhatsApp para ayudarte con tu plan, pagos o cualquier consulta.</p>
            <Button variant="secondary" asChild className="gap-2">
              <a href={WHATSAPP_URL('Hola, tengo una consulta sobre GestorPro')} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" /> Chatear por WhatsApp
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Plans;
