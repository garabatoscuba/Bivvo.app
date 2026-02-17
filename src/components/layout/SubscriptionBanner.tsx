import { Link } from 'react-router-dom';
import { useSubscription } from '@/hooks/useSubscription';
import { AlertTriangle, Clock, XCircle } from 'lucide-react';

const SubscriptionBanner = () => {
  const { status, daysLeft, loading } = useSubscription();

  if (loading || status === 'active') return null;

  if (status === 'trial') {
    return (
      <div className="flex items-center gap-2 bg-info px-4 py-2 text-sm text-info-foreground">
        <Clock className="h-4 w-4 shrink-0" />
        <span>Te quedan <strong>{daysLeft}</strong> días de prueba gratuita.</span>
        <Link to="/plans" className="ml-auto font-semibold underline">Ver planes</Link>
      </div>
    );
  }

  if (status === 'expiring') {
    return (
      <div className="flex items-center gap-2 bg-warning px-4 py-2 text-sm text-warning-foreground">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>Tu {daysLeft !== null && daysLeft > 0 ? `plan vence en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}` : 'plan vence hoy'}. ¡Renueva ahora!</span>
        <Link to="/plans" className="ml-auto font-semibold underline">Ver planes</Link>
      </div>
    );
  }

  if (status === 'blocked') {
    return (
      <div className="flex items-center gap-2 bg-destructive px-4 py-2 text-sm text-destructive-foreground">
        <XCircle className="h-4 w-4 shrink-0" />
        <span>Tu acceso ha expirado. Contacta por WhatsApp para renovar.</span>
        <Link to="/plans" className="ml-auto font-semibold underline">Ver planes</Link>
      </div>
    );
  }

  return null;
};

export default SubscriptionBanner;
