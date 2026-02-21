import { Link } from 'react-router-dom';
import { useSubscription } from '@/hooks/useSubscription';
import { AlertTriangle, Clock, XCircle, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SubscriptionBanner = () => {
  const { status, daysLeft, planType, loading } = useSubscription();

  if (loading) return null;

  // Free plan never shows a banner
  if (planType === 'free') return null;

  // Show banner for active trial (not just when expiring)
  if (status === 'active') return null;

  if (status === 'trial') {
    return (
      <div className="flex items-center gap-2 bg-info px-4 py-2 text-sm text-info-foreground">
        <Clock className="h-4 w-4 shrink-0" />
        <span>Te quedan <strong>{daysLeft}</strong> días de prueba del plan {planType === 'professional' ? 'Profesional' : 'Básico'}.</span>
        <Link to="/plans" className="ml-auto shrink-0">
          <Button size="sm" variant="secondary" className="gap-1.5 h-7 text-xs">
            <ShoppingCart className="h-3 w-3" /> Comprar plan
          </Button>
        </Link>
      </div>
    );
  }

  if (status === 'expiring') {
    return (
      <div className="flex items-center gap-2 bg-warning px-4 py-2 text-sm text-warning-foreground">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>Tu plan {daysLeft !== null && daysLeft > 0 ? `vence en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}` : 'vence hoy'}. ¡Renueva ahora!</span>
        <Link to="/plans" className="ml-auto font-semibold underline">Ver planes</Link>
      </div>
    );
  }

  if (status === 'blocked') {
    return (
      <div className="flex items-center gap-2 bg-destructive px-4 py-2 text-sm text-destructive-foreground">
        <XCircle className="h-4 w-4 shrink-0" />
        <span>Tu plan ha expirado. Bajarás al plan gratuito o renueva por WhatsApp.</span>
        <Link to="/plans" className="ml-auto font-semibold underline">Ver planes</Link>
      </div>
    );
  }

  return null;
};

export default SubscriptionBanner;
