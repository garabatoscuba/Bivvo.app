import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ModalidadesTab from '@/components/nomina/ModalidadesTab';
import CommissionsTab from '@/components/cobro/CommissionsTab';
import SalaryConfigTab from '@/components/cobro/SalaryConfigTab';
import TipConfigTab from '@/components/nomina/TipConfigTab';
import PayrollHistory from '@/components/nomina/PayrollHistory';

const Nomina = () => {
  const { profile } = useAuth();
  const businessId = profile?.business_id;

  if (!businessId) return null;

  return (
    <AppLayout title="Nómina">
      <Tabs defaultValue="modalidades" className="space-y-4">
        <TabsList className="w-full flex overflow-x-auto">
          <TabsTrigger value="modalidades" className="flex-1 text-xs">Modalidades</TabsTrigger>
          <TabsTrigger value="comisiones" className="flex-1 text-xs">Comisiones</TabsTrigger>
          <TabsTrigger value="config" className="flex-1 text-xs">Puestos</TabsTrigger>
          <TabsTrigger value="propinas" className="flex-1 text-xs">Propinas</TabsTrigger>
          <TabsTrigger value="historial" className="flex-1 text-xs">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="modalidades">
          <ModalidadesTab businessId={businessId} />
        </TabsContent>

        <TabsContent value="comisiones">
          <CommissionsTab businessId={businessId} />
        </TabsContent>

        <TabsContent value="config">
          <SalaryConfigTab businessId={businessId} />
        </TabsContent>

        <TabsContent value="propinas">
          <TipConfigTab businessId={businessId} />
        </TabsContent>

        <TabsContent value="historial">
          <PayrollHistory businessId={businessId} showAllEmployees />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default Nomina;
