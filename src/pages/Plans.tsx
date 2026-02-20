import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Crown, MessageCircle, CalendarDays, Building2, DollarSign, Star } from 'lucide-react';
import { useSubscription, PlanType } from '@/hooks/useSubscription';
import { useBranches } from '@/hooks/useBranches';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const WHATSAPP_NUMBER = '5352514878';
const WHATSAPP_URL = (msg: string) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;

const PLAN_LABELS: Record<PlanType, string> = {
  free: 'Gratuito',
  basic: 'Básico',
  professional: 'Profesional',
};

const Plans = () => {
  const { status, daysLeft, planType, trialEndsAt, subscriptionEndsAt } = useSubscription();
  const { data: branches = [] } = useBranches();

  const branchCount = Math.max(1, branches.length);
  const pricePerBranch = planType === 'professional' ? 20 : planType === 'basic' ? 10 : 0;
  const totalMonthly = pricePerBranch * branchCount;
  const expirationDate = subscriptionEndsAt || trialEndsAt;

  const freePlanFeatures = [
    'Inventario limitado (5 productos)',
    'Punto de Venta (POS) completo',
    'Gráficas de desempeño',
    '1 Sucursal',
    'Sin límite de tiempo',
  ];

  const basicFeatures = [
    'Inventario ilimitado',
    'Punto de Venta (POS) completo',
    'Módulo de Clientes y Afiliación',
    'Módulo de negocio a elegir',
    'Gráficas de desempeño',
    'Soporte por WhatsApp',
  ];

  const professionalFeatures = [
    'Todo lo del Plan Básico',
    'Contabilidad completa',
    'Portales públicos personalizables',
    'Enlace entre negocios',
    'Soporte prioritario',
  ];

  return (
    <AppLayout title="Planes y Precios">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Account summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Resumen de tu cuenta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground">Plan actual</p>
                <p className="mt-1 text-lg font-semibold">{PLAN_LABELS[planType]}</p>
                {status === 'trial' && <Badge variant="secondary" className="mt-1">Trial</Badge>}
              </div>

              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground">
                  {status === 'blocked' ? 'Estado' : planType === 'free' ? 'Estado' : 'Vence'}
                </p>
                {status === 'blocked' ? (
                  <p className="mt-1 text-lg font-semibold text-destructive">Expirado</p>
                ) : planType === 'free' ? (
                  <p className="mt-1 text-lg font-semibold text-success">Activo</p>
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

              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Sucursales
                </p>
                <p className="mt-1 text-lg font-semibold">{branches.length}</p>
              </div>

              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> Total mensual
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {planType === 'free' ? '$0' : `$${totalMonthly}`}
                </p>
                {planType !== 'free' && branchCount > 1 && (
                  <p className="text-xs text-muted-foreground">${pricePerBranch} × {branchCount} sucursales</p>
                )}
              </div>
            </div>

            {(status === 'blocked' || status === 'expiring') && planType !== 'free' && (
              <div className="mt-4 flex justify-center">
                <Button asChild className="gap-2">
                  <a href={WHATSAPP_URL(`Hola, quiero renovar mi plan ${PLAN_LABELS[planType]} de GestorPro. Tengo ${branchCount} sucursal(es). Total: $${totalMonthly}/mes`)} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4" /> Renovar por WhatsApp
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plan cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Free */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg">Plan Gratuito</CardTitle>
              <CardDescription>Para empezar sin compromiso</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <p className="text-3xl font-bold">$0</p>
              <p className="text-sm text-muted-foreground">Para siempre, sin tarjeta</p>
              <ul className="mt-4 space-y-2">
                {freePlanFeatures.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-success shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              {planType === 'free' ? (
                <Badge variant="outline" className="w-full justify-center py-2">Plan actual</Badge>
              ) : (
                <span className="w-full text-center text-xs text-muted-foreground">Siempre disponible</span>
              )}
            </CardFooter>
          </Card>

          {/* Basic */}
          <Card className="flex flex-col border-primary relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="gap-1"><Star className="h-3 w-3" /> Popular</Badge>
            </div>
            <CardHeader className="pt-8">
              <CardTitle className="text-lg">Plan Básico</CardTitle>
              <CardDescription>Inventario y clientes sin límites</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <p className="text-3xl font-bold">$10 <span className="text-sm font-normal text-muted-foreground">USD/mes/sucursal</span></p>
              <p className="text-sm text-muted-foreground">7 días gratis · Sin tarjeta</p>
              <ul className="mt-4 space-y-2">
                {basicFeatures.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-success shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              {planType === 'basic' && status !== 'blocked' ? (
                <Badge variant="outline" className="w-full justify-center py-2">Plan actual</Badge>
              ) : (
                <Button asChild className="w-full gap-2">
                  <a href={WHATSAPP_URL('Hola, quiero activar el Plan Básico de GestorPro')} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4" /> Activar por WhatsApp
                  </a>
                </Button>
              )}
            </CardFooter>
          </Card>

          {/* Professional */}
          <Card className="flex flex-col relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge variant="secondary" className="gap-1"><Crown className="h-3 w-3" /> Pro</Badge>
            </div>
            <CardHeader className="pt-8">
              <CardTitle className="text-lg">Plan Profesional</CardTitle>
              <CardDescription>Todo para escalar tu negocio</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <p className="text-3xl font-bold">$20 <span className="text-sm font-normal text-muted-foreground">USD/mes/sucursal</span></p>
              <p className="text-sm text-muted-foreground">7 días gratis · Sin tarjeta</p>
              <ul className="mt-4 space-y-2">
                {professionalFeatures.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-success shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              {planType === 'professional' && status !== 'blocked' ? (
                <Badge variant="outline" className="w-full justify-center py-2">Plan actual</Badge>
              ) : (
                <Button asChild variant="outline" className="w-full gap-2">
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
