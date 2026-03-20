import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PeriodFilter, type Period } from '@/components/ui/period-filter';
import { Loader2, Lock } from 'lucide-react';
import { useReportData } from '@/hooks/useReportData';
import { useJornadaActiva } from '@/hooks/useJornadaActiva';
import SinJornadaActiva from '@/components/employees/SinJornadaActiva';
import ReportesResumenTab from '@/components/cobro/ReportesResumenTab';
import ReportesPorEmpleadoTab from '@/components/cobro/ReportesPorEmpleadoTab';
import ReportesVsTab from '@/components/cobro/ReportesVsTab';
import ReportesComparativaTab from '@/components/cobro/ReportesComparativaTab';
import AdminReportesTab from '@/components/cobro/AdminReportesTab';
import BitacoraTab from '@/components/cobro/BitacoraTab';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import PlanGateModal from '@/components/PlanGateModal';

const Cobros = () => {
  const { profile, isOwner, isManager, isSuperAdmin } = useAuth();
  const businessId = profile?.business_id;
  const [period, setPeriod] = useState<Period>('today');
  const { jornadaActiva, isLoading: jornadaLoading } = useJornadaActiva();
  const canBypassJornada = isOwner || isSuperAdmin;
  const { hasFeature, requiredPlanFor } = usePlanFeatures();

  const [gateOpen, setGateOpen] = useState(false);
  const [gateRequiredPlan, setGateRequiredPlan] = useState('Enterprise');

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

  const handleTabClick = (featureKey: string, e: React.MouseEvent) => {
    const key = featureKey as any;
    if (!hasFeature(key)) {
      e.preventDefault();
      e.stopPropagation();
      setGateRequiredPlan(requiredPlanFor(key));
      setGateOpen(true);
    }
  };

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
            <TabsTrigger
              value="empleados"
              className="flex-1 text-xs sm:text-sm gap-1"
              onClick={(e) => handleTabClick('reportes_por_empleado', e)}
            >
              Por Empleado
              {!hasFeature('reportes_por_empleado') && <Lock className="h-3 w-3 text-muted-foreground" />}
            </TabsTrigger>
            <TabsTrigger
              value="vs"
              className="flex-1 text-xs sm:text-sm gap-1"
              onClick={(e) => handleTabClick('reportes_vs', e)}
            >
              Ventas vs Serv.
              {!hasFeature('reportes_vs') && <Lock className="h-3 w-3 text-muted-foreground" />}
            </TabsTrigger>
            <TabsTrigger
              value="comparativa"
              className="flex-1 text-xs sm:text-sm gap-1"
              onClick={(e) => handleTabClick('reportes_comparativa', e)}
            >
              Comparativa
              {!hasFeature('reportes_comparativa') && <Lock className="h-3 w-3 text-muted-foreground" />}
            </TabsTrigger>
            <TabsTrigger value="historial" className="flex-1 text-xs sm:text-sm">Historial</TabsTrigger>
            {isOwner && (
              <TabsTrigger
                value="bitacora"
                className="flex-1 text-xs sm:text-sm gap-1"
                onClick={(e) => handleTabClick('reportes_bitacora', e)}
              >
                Bitácora
                {!hasFeature('reportes_bitacora') && <Lock className="h-3 w-3 text-muted-foreground" />}
              </TabsTrigger>
            )}
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

          {hasFeature('reportes_por_empleado') && (
            <TabsContent value="empleados">
              <ReportesPorEmpleadoTab employees={employeeData} />
            </TabsContent>
          )}

          {hasFeature('reportes_vs') && (
            <TabsContent value="vs">
              <ReportesVsTab sales={currentSales} services={currentServices} />
            </TabsContent>
          )}

          {hasFeature('reportes_comparativa') && (
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
          )}

          <TabsContent value="historial">
            <AdminReportesTab businessId={businessId} />
          </TabsContent>

          {isOwner && hasFeature('reportes_bitacora') && (
            <TabsContent value="bitacora">
              <BitacoraTab businessId={businessId} />
            </TabsContent>
          )}
        </Tabs>
      )}

      <PlanGateModal open={gateOpen} onOpenChange={setGateOpen} requiredPlan={gateRequiredPlan} />
    </AppLayout>
  );
};

export default Cobros;
