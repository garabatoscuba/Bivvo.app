import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { CreditCard } from 'lucide-react';

const Nomina = () => {
  const navigate = useNavigate();

  return (
    <AppLayout title="Nómina">
      <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
        <CreditCard className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Próximamente</h2>
        <p className="text-muted-foreground max-w-md">
          El módulo de Nómina estará disponible con el plan Profesional. Gestiona modalidades de salario, comisiones y frecuencia de pago.
        </p>
        <Button onClick={() => navigate('/plans')}>Ver Planes</Button>
      </div>
    </AppLayout>
  );
};

export default Nomina;
