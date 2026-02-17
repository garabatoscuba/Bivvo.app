import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Crown, Building2, MessageCircle, Clock } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';

const WHATSAPP_NUMBER = '53552514878';
const WHATSAPP_URL = (msg: string) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;

const Plans = () => {
  const { status, daysLeft, planType } = useSubscription();

  const statusLabel = () => {
    if (status === 'trial') return `Prueba gratuita — ${daysLeft} días restantes`;
    if (status === 'expiring') return `Tu plan vence en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}`;
    if (status === 'active') return 'Plan activo';
    return 'Plan expirado';
  };

  const statusColor = () => {
    if (status === 'trial') return 'default';
    if (status === 'expiring') return 'secondary';
    if (status === 'active') return 'default';
    return 'destructive';
  };

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
        {/* Current status */}
        <div className="flex items-center justify-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Tu estado actual:</span>
          <Badge variant={statusColor()}>{statusLabel()}</Badge>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
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

          {/* MVP */}
          <Card className="flex flex-col border-primary relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="gap-1"><Crown className="h-3 w-3" /> Recomendado</Badge>
            </div>
            <CardHeader className="pt-8">
              <CardTitle className="text-lg">Plan MVP</CardTitle>
              <CardDescription>Todo lo que necesitas</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <p className="text-3xl font-bold">$10 <span className="text-sm font-normal text-muted-foreground">USD/mes</span></p>
              <p className="text-sm text-muted-foreground">Por negocio</p>
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
                  <a href={WHATSAPP_URL('Hola, quiero activar el Plan MVP de GestorPro')} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4" /> Activar por WhatsApp
                  </a>
                </Button>
              )}
            </CardFooter>
          </Card>

          {/* Extra branches */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Building2 className="h-5 w-5" /> Sucursales Extra</CardTitle>
              <CardDescription>Expande tu negocio</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <p className="text-3xl font-bold">+$10 <span className="text-sm font-normal text-muted-foreground">USD/mes c/u</span></p>
              <p className="text-sm text-muted-foreground">Por sucursal adicional</p>
              <ul className="mt-4 space-y-2">
                <li className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-success shrink-0" />Inventario independiente</li>
                <li className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-success shrink-0" />POS por sucursal</li>
                <li className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-success shrink-0" />Reportes separados</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button variant="outline" asChild className="w-full gap-2">
                <a href={WHATSAPP_URL('Hola, quiero agregar una sucursal extra en GestorPro')} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4" /> Contactar
                </a>
              </Button>
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
