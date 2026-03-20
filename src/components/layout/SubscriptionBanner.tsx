import { useNavigate } from 'react-router-dom';
import { useSubscription } from '@/hooks/useSubscription';
import { AlertTriangle, Clock, XCircle, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SubscriptionBanner = () => {
  const { status, daysLeft, planType, loading } = useSubscription();
  const navigate = useNavigate();

  if (loading) return null;
  if (planType === 'free') return null;
  if (status === 'active') return null;

  if (status === 'trial') {
    return (
      <div className="flex items-center gap-2 bg-info px-4 py-2 text-sm text-info-foreground">
        <Clock className="h-4 w-4 shrink-0" />
        <span>Te quedan <strong>{daysLeft}</strong> días de prueba del plan {planType === 'enterprise' ? 'Enterprise' : 'Profesional'}.</span>
        <Button
          size="sm"
          variant="secondary"
          className="ml-auto shrink-0 gap-1.5 h-7 text-xs"
          onClick={() => navigate('/plans?buy=true')}
        >
          <ShoppingCart className="h-3 w-3" /> Comprar plan
        </Button>
      </div>
    );
  }

  if (status === 'expiring') {
    return (
      <div className="flex items-center gap-2 bg-warning px-4 py-2 text-sm text-warning-foreground">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>Tu plan {daysLeft !== null && daysLeft > 0 ? `vence en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}` : 'vence hoy'}. ¡Renueva ahora!</span>
        <Button size="sm" variant="secondary" className="ml-auto gap-1.5 h-7 text-xs" onClick={() => navigate('/plans?buy=true')}>
          Renovar plan
        </Button>
      </div>
    );
  }

  if (status === 'blocked') {
    return (
      <div className="flex items-center gap-2 bg-destructive px-4 py-2 text-sm text-destructive-foreground">
        <XCircle className="h-4 w-4 shrink-0" />
        <span>Tu plan ha expirado. Bajarás al plan gratuito o renueva.</span>
        <Button size="sm" variant="secondary" className="ml-auto gap-1.5 h-7 text-xs" onClick={() => navigate('/plans')}>
          Ver planes
        </Button>
      </div>
    );
  }

  return null;
};

export default SubscriptionBanner;
