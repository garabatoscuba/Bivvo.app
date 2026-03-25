import ReportesVsTab from './ReportesVsTab';
import ReportesComparativaTab from './ReportesComparativaTab';
import type { ReportEntry } from '@/hooks/useReportData';

interface Props {
  currentSales: ReportEntry[];
  currentServices: ReportEntry[];
  currentAll: ReportEntry[];
  prevSales: ReportEntry[];
  prevServices: ReportEntry[];
  prevAll: ReportEntry[];
  periodLabel: string;
}

const ComparativaTab = ({
  currentSales,
  currentServices,
  currentAll,
  prevSales,
  prevServices,
  prevAll,
  periodLabel,
}: Props) => {
  return (
    <div className="space-y-6">
      {/* Ventas vs Servicios with donut */}
      <ReportesVsTab sales={currentSales} services={currentServices} />

      {/* Period comparison cards */}
      <ReportesComparativaTab
        currentAll={currentAll}
        prevAll={prevAll}
        currentSales={currentSales}
        prevSales={prevSales}
        currentServices={currentServices}
        prevServices={prevServices}
        periodLabel={periodLabel}
        prevLabel=""
      />
    </div>
  );
};

export default ComparativaTab;
