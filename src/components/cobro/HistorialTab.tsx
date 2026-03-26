import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, Banknote, TrendingUp } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import AdminReportesTab from './AdminReportesTab';
import ReportesPorEmpleadoTab from './ReportesPorEmpleadoTab';
import BitacoraTab from './BitacoraTab';
import type { EmployeeReport } from '@/hooks/useReportData';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  businessId: string;
  employees: EmployeeReport[];
}

const HistorialTab = ({ businessId, employees }: Props) => {
  const { isOwner, isSuperAdmin } = useAuth();
  const canSeeBitacora = isOwner || isSuperAdmin;

  const [view, setView] = useState<string>('actividad');

  const totalSalarios = employees.reduce((s, e) => s + e.estimatedSalary, 0);
  const totalPropinas = employees.reduce((s, e) => s + e.tips, 0);
  const totalRecaudado = employees.reduce((s, e) => s + e.totalCollected, 0);
  const totalAEntregar = totalRecaudado - totalSalarios - totalPropinas;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">Salarios</span>
            </div>
            <p className="text-lg font-bold">${totalSalarios.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Banknote className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">A entregar</span>
            </div>
            <p className="text-lg font-bold">${totalAEntregar > 0 ? totalAEntregar.toFixed(2) : '0.00'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">Propinas</span>
            </div>
            <p className="text-lg font-bold">${totalPropinas.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

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
          <BitacoraTab businessId={businessId} />
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
