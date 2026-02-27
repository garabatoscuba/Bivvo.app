import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CobrosResumen from '@/components/cobro/CobrosResumen';
import AdminReportesTab from '@/components/cobro/AdminReportesTab';

const Cobros = () => {
  const { profile } = useAuth();
  const businessId = profile?.business_id;

  if (!businessId) return null;

  return (
    <AppLayout title="Reportes">
      <Tabs defaultValue="resumen" className="space-y-4">
        <TabsList className="w-full">
          <TabsTrigger value="resumen" className="flex-1">Resumen</TabsTrigger>
          <TabsTrigger value="reportes" className="flex-1">Reportes</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
          <CobrosResumen />
        </TabsContent>

        <TabsContent value="reportes">
          <AdminReportesTab businessId={businessId} />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default Cobros;
