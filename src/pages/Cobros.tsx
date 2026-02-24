import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminReportesTab from '@/components/cobro/AdminReportesTab';
import CobrosResumen from '@/components/cobro/CobrosResumen';

const Cobros = () => {
  const { profile } = useAuth();

  return (
    <AppLayout>
      <div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Reportes</h1>
          <p className="text-sm text-muted-foreground">Reportes diarios y resumen de cobros</p>
        </div>

        <Tabs defaultValue="reportes" className="space-y-4">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="reportes">Reportes</TabsTrigger>
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
          </TabsList>

          <TabsContent value="reportes">
            <AdminReportesTab businessId={profile?.business_id || ''} />
          </TabsContent>
          <TabsContent value="resumen">
            <CobrosResumen />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Cobros;
