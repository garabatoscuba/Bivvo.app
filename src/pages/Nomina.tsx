import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { CreditCard } from 'lucide-react';
import ModalidadesTab from '@/components/nomina/ModalidadesTab';
import CommissionsTab from '@/components/cobro/CommissionsTab';

const Nomina = () => {
  const { profile } = useAuth();
  const { planType } = useSubscription();
  const navigate = useNavigate();

  const businessId = profile?.business_id || '';

  // business_type query removed – copies tab eliminated

  if (planType === 'free') {
    return (
      <AppLayout title="Nómina">
        <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
          <CreditCard className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Función Premium</h2>
          <p className="text-muted-foreground max-w-md">
            El módulo de Nómina está disponible a partir del plan Básico. Gestiona modalidades de salario, comisiones y frecuencia de pago.
          </p>
          <Button onClick={() => navigate('/plans')}>Ver Planes</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Nómina">
      <div className="space-y-4 md:space-y-6 overflow-hidden max-w-full">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Nómina</h1>
          <p className="text-sm text-muted-foreground">Gestión de modalidades de salario, comisiones y pagos</p>
        </div>

        <Tabs defaultValue="modalidades" className="space-y-4">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="modalidades">Modalidades</TabsTrigger>
            <TabsTrigger value="comisiones">Comisiones</TabsTrigger>
          </TabsList>

          <TabsContent value="modalidades">
            <ModalidadesTab businessId={businessId} />
          </TabsContent>
          <TabsContent value="comisiones">
            <CommissionsTab businessId={businessId} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Nomina;
