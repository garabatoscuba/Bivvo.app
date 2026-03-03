import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PeriodFilter, type Period } from '@/components/ui/period-filter';
import { Loader2 } from 'lucide-react';
import { useReportData } from '@/hooks/useReportData';
import { useJornadaActiva } from '@/hooks/useJornadaActiva';
import SinJornadaActiva from '@/components/employees/SinJornadaActiva';
import ReportesResumenTab from '@/components/cobro/ReportesResumenTab';
import ReportesPorEmpleadoTab from '@/components/cobro/ReportesPorEmpleadoTab';
import ReportesVsTab from '@/components/cobro/ReportesVsTab';
import ReportesComparativaTab from '@/components/cobro/ReportesComparativaTab';
import AdminReportesTab from '@/components/cobro/AdminReportesTab';

const Cobros = () => {
  const { profile, isOwner, isManager, isSuperAdmin } = useAuth();
  const businessId = profile?.business_id;
  const [period, setPeriod] = useState<Period>('today');
  const { jornadaActiva, isLoading: jornadaLoading } = useJornadaActiva();
  const canBypassJornada = isOwner || isSuperAdmin;

  const {
    isLoading,
    currentSales,
    currentServices,
    currentAll,
    currentMermas,
    prevSales,
    prevServices,
    prevAll,
    dailyBreakdown,
    employeeData,
  } = useReportData(period);

  if (!businessId) return null;

  if (!canBypassJornada && jornadaLoading) {
    return <AppLayout title="Reportes"><div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div></AppLayout>;
  }

  if (!canBypassJornada && !jornadaActiva) {
    return <AppLayout title="Reportes"><SinJornadaActiva /></AppLayout>;
  }

  return (
    <AppLayout title="Reportes">
      <div className="flex justify-end mb-3">
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <Tabs defaultValue="resumen" className="space-y-4">
          <TabsList className="w-full flex-wrap h-auto gap-1">
            <TabsTrigger value="resumen" className="flex-1 text-xs sm:text-sm">Resumen</TabsTrigger>
            <TabsTrigger value="empleados" className="flex-1 text-xs sm:text-sm">Por Empleado</TabsTrigger>
            <TabsTrigger value="vs" className="flex-1 text-xs sm:text-sm">Ventas vs Serv.</TabsTrigger>
            <TabsTrigger value="comparativa" className="flex-1 text-xs sm:text-sm">Comparativa</TabsTrigger>
            <TabsTrigger value="historial" className="flex-1 text-xs sm:text-sm">Historial</TabsTrigger>
          </TabsList>

          <TabsContent value="resumen">
            <ReportesResumenTab
              sales={currentSales}
              services={currentServices}
              all={currentAll}
              dailyBreakdown={dailyBreakdown}
              mermas={currentMermas}
            />
          </TabsContent>

          <TabsContent value="empleados">
            <ReportesPorEmpleadoTab employees={employeeData} />
          </TabsContent>

          <TabsContent value="vs">
            <ReportesVsTab sales={currentSales} services={currentServices} />
          </TabsContent>

          <TabsContent value="comparativa">
            <ReportesComparativaTab
              currentAll={currentAll}
              prevAll={prevAll}
              currentSales={currentSales}
              prevSales={prevSales}
              currentServices={currentServices}
              prevServices={prevServices}
              periodLabel={period}
              prevLabel=""
            />
          </TabsContent>

          <TabsContent value="historial">
            <AdminReportesTab businessId={businessId} />
          </TabsContent>
        </Tabs>
      )}
    </AppLayout>
  );
};

export default Cobros;
