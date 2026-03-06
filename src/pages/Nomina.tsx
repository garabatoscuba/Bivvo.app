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
        <TabsList className="w-full flex flex-nowrap overflow-x-auto scrollbar-hide h-9">
          <TabsTrigger value="modalidades" className="shrink-0 text-xs">Modalidades</TabsTrigger>
          <TabsTrigger value="comisiones" className="shrink-0 text-xs">Comisiones</TabsTrigger>
          <TabsTrigger value="config" className="shrink-0 text-xs">Puestos</TabsTrigger>
          <TabsTrigger value="propinas" className="shrink-0 text-xs">Propinas</TabsTrigger>
          <TabsTrigger value="historial" className="shrink-0 text-xs">Historial</TabsTrigger>
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
