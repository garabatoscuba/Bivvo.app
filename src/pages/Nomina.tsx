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
        <div className="w-full overflow-x-auto scrollbar-hide">
          <TabsList className="inline-flex w-max min-w-full h-9">
            <TabsTrigger value="modalidades" className="shrink-0 text-xs px-3">Modalidades</TabsTrigger>
            <TabsTrigger value="comisiones" className="shrink-0 text-xs px-3">Comisiones</TabsTrigger>
            <TabsTrigger value="config" className="shrink-0 text-xs px-3">Puestos</TabsTrigger>
            <TabsTrigger value="propinas" className="shrink-0 text-xs px-3">Propinas</TabsTrigger>
            <TabsTrigger value="historial" className="shrink-0 text-xs px-3">Historial</TabsTrigger>
          </TabsList>
        </div>

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
