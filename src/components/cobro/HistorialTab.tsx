import { useState } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import AdminReportesTab from './AdminReportesTab';
import ReportesPorEmpleadoTab from './ReportesPorEmpleadoTab';
import BitacoraTab from './BitacoraTab';
import type { EmployeeReport } from '@/hooks/useReportData';
import { useAuth } from '@/contexts/AuthContext';
import type { Period } from '@/components/ui/period-filter';

interface Props {
  businessId: string;
  employees: EmployeeReport[];
  period: Period;
}

const HistorialTab = ({ businessId, employees, period }: Props) => {
  const { isOwner, isSuperAdmin } = useAuth();
  const canSeeBitacora = isOwner || isSuperAdmin;

  const [view, setView] = useState<string>('actividad');

  return (
    <div className="space-y-4">
      {/* Toggle selector */}
      <div className="flex justify-center">
        <ToggleGroup type="single" value={view} onValueChange={v => v && setView(v)} className="bg-muted p-1 rounded-lg">
          {canSeeBitacora && (
            <ToggleGroupItem value="actividad" className="text-xs px-4 data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm rounded-md">
              Actividad
            </ToggleGroupItem>
          )}
          <ToggleGroupItem value="empleados" className="text-xs px-4 data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm rounded-md">
            Por empleado
          </ToggleGroupItem>
          <ToggleGroupItem value="cierres" className="text-xs px-4 data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm rounded-md">
            Cierres
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Content */}
      {view === 'actividad' && canSeeBitacora && (
        <div onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
          <BitacoraTab businessId={businessId} period={period} />
        </div>
      )}
      {view === 'empleados' && (
        <ReportesPorEmpleadoTab employees={employees} />
      )}
      {view === 'cierres' && (
        <AdminReportesTab businessId={businessId} />
      )}
    </div>
  );
};

export default HistorialTab;
