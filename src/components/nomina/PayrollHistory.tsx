import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, History, DollarSign } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const MODALITY_LABELS: Record<string, string> = {
  fixed: 'Fijo',
  fixed_ladder: 'Fijo con Escalera',
  fixed_plus_sales_percent: 'Fijo + % Ventas',
  sales_percent_only: 'Solo % Ventas',
  profit_percent: '% Ganancia',
  fixed_plus_goal_bonus: 'Fijo + Bono Meta',
  hourly: 'Por Horas',
  custom_mixed: 'Mixto Personalizado',
};

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Diaria',
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
};

interface PayrollHistoryProps {
  employeeId?: string; // employees table ID (for salary_assignments)
  userId?: string; // auth user_id (for daily_reports)
  businessId: string;
  showAllEmployees?: boolean; // admin view all
}

const PayrollHistory = ({ employeeId, userId, businessId, showAllEmployees }: PayrollHistoryProps) => {
  // Fetch salary assignments
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['salary-assignments-history', businessId, employeeId, showAllEmployees],
    queryFn: async () => {
      let query = supabase
        .from('employee_salary_assignments')
        .select('*, salary_modalities(name, modality_type), employees:employee_id(full_name)')
        .eq('business_id', businessId);

      if (employeeId && !showAllEmployees) {
        query = query.eq('employee_id', employeeId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
  });

  // Fetch daily reports for the employee(s)
  const reportFilterId = userId || employeeId;
  const { data: reports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['payroll-reports', businessId, reportFilterId, showAllEmployees],
    queryFn: async () => {
      let query = supabase
        .from('daily_reports')
        .select('*')
        .eq('business_id', businessId)
        .order('date', { ascending: false })
        .limit(50);

      if (reportFilterId && !showAllEmployees) {
        // If we have userId, filter by user_id; otherwise use employee_id
        if (userId) {
          query = query.eq('user_id', userId);
        } else {
          query = query.eq('employee_id', reportFilterId);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
  });

  if (isLoading || reportsLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Current assignments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Asignaciones Salariales Activas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No hay asignaciones salariales configuradas</p>
          ) : (
            <div className="space-y-2">
              {assignments.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {a.employees?.full_name || 'Empleado'}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="secondary" className="text-[10px]">
                        {MODALITY_LABELS[a.salary_modalities?.modality_type] || a.salary_modalities?.name || 'Sin modalidad'}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {FREQUENCY_LABELS[a.pay_frequency] || a.pay_frequency}
                      </Badge>
                      {a.base_salary > 0 && (
                        <span className="text-xs text-muted-foreground">Base: ${Number(a.base_salary).toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                  <Badge variant={a.is_active ? 'default' : 'secondary'} className="text-[10px]">
                    {a.is_active ? 'Activa' : 'Inactiva'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reports history */}
      {reports.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" />
              Historial de Cobros
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Mobile */}
            <div className="space-y-2 md:hidden">
              {reports.map((r: any) => (
                <div key={r.id} className="border rounded-lg p-3 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">
                      {format(new Date(r.date), 'dd MMM yyyy', { locale: es })}
                    </span>
                    <span className="text-sm font-bold text-primary">${Number(r.total_salary).toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                    <span>Servicios: ${Number(r.service_earning).toFixed(2)}</span>
                    <span>Comisiones: ${Number(r.commission_earning).toFixed(2)}</span>
                    <span>Copias: ${Number(r.copies_earning).toFixed(2)}</span>
                    <span>Propinas: ${Number(r.tips).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Servicios</TableHead>
                    <TableHead className="text-right">Comisiones</TableHead>
                    <TableHead className="text-right">Copias</TableHead>
                    <TableHead className="text-right">Propinas</TableHead>
                    <TableHead className="text-right">Total Salario</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{format(new Date(r.date), 'dd MMM yyyy', { locale: es })}</TableCell>
                      <TableCell className="text-right">${Number(r.service_earning).toFixed(2)}</TableCell>
                      <TableCell className="text-right">${Number(r.commission_earning).toFixed(2)}</TableCell>
                      <TableCell className="text-right">${Number(r.copies_earning).toFixed(2)}</TableCell>
                      <TableCell className="text-right">${Number(r.tips).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-bold">${Number(r.total_salary).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PayrollHistory;
