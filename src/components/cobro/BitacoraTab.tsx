import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import type { Period } from '@/components/ui/period-filter';
import { getDateRange } from '@/lib/periodUtils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Download, Copy, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const ACTION_LABELS: Record<string, string> = {
  sale_created: 'Venta registrada',
  sale_cancelled: 'Venta cancelada',
  service_charge_created: 'Cobro de servicio',
  inventory_entry: 'Entrada de inventario',
  stock_transfer: 'Transferencia de stock',
  shrinkage_registered: 'Merma registrada',
  cash_register_opened: 'Caja abierta',
  cash_register_closed: 'Caja cerrada',
  shift_started: 'Jornada iniciada',
  shift_ended: 'Jornada cerrada',
  expense_paid: 'Gasto pagado',
  balance_movement_created: 'Movimiento de balance',
  employee_created: 'Empleado creado',
  employee_edited: 'Empleado editado',
  employee_deleted: 'Empleado eliminado',
  print_job_created: 'Trabajo de impresión',
  anulacion_compra: 'Anulación de compra',
  anulacion_entrada_insumo: 'Anulación de entrada insumo',
  anulacion_movimiento: 'Anulación de movimiento',
};

const PAGE_SIZE = 50;

interface BitacoraTabProps {
  businessId: string;
  period: Period;
}

const BitacoraTab = ({ businessId, period }: BitacoraTabProps) => {
  const [searchCode, setSearchCode] = useState('');
  const [filterEmployee, setFilterEmployee] = useState<string>('all');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [page, setPage] = useState(0);

  // Fetch employees for dropdown
  const { data: employees } = useQuery({
    queryKey: ['bitacora-employees', businessId],
    queryFn: async () => {
      const { data } = await supabase
        .from('employees')
        .select('id, full_name')
        .eq('business_id', businessId)
        .order('full_name');
      return data || [];
    },
  });

  // Fetch audit logs
  const periodRange = useMemo(() => getDateRange(period), [period]);

  const { data: logsData, isLoading } = useQuery({
    queryKey: ['audit-logs', businessId, searchCode, filterEmployee, filterAction, dateFrom?.toISOString(), dateTo?.toISOString(), page, period],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .eq('business_id', businessId)
        .gte('created_at', periodRange.start.toISOString())
        .lte('created_at', periodRange.end.toISOString())
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (searchCode.trim()) {
        query = query.ilike('code', `%${searchCode.trim()}%`);
      }
      if (filterEmployee && filterEmployee !== 'all') {
        query = query.eq('user_name', filterEmployee);
      }
      if (filterAction && filterAction !== 'all') {
        query = query.eq('action_type', filterAction);
      }
      if (dateFrom) {
        query = query.gte('created_at', dateFrom.toISOString());
      }
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endOfDay.toISOString());
      }

      const { data, count, error } = await query;
      if (error) throw error;
      return { logs: data || [], total: count || 0 };
    },
  });

  const logs = logsData?.logs || [];
  const totalCount = logsData?.total || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Código copiado');
  };

  const exportCSV = () => {
    if (!logs.length) return;
    const headers = ['Código', 'Fecha', 'Empleado', 'Rol', 'Acción', 'Descripción', 'Sucursal', 'Dispositivo'];
    const rows = logs.map((l: any) => [
      l.code,
      format(new Date(l.created_at), 'dd/MM/yyyy HH:mm', { locale: es }),
      l.user_name,
      l.user_role,
      ACTION_LABELS[l.action_type] || l.action_type,
      `"${(l.action_description || '').replace(/"/g, '""')}"`,
      l.branch_id || '—',
      l.device_info || '—',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bitacora-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Unique employee names from logs for filter
  const employeeNames = useMemo(() => {
    const names = employees?.map(e => e.full_name).filter(Boolean) as string[] || [];
    return [...new Set(names)].sort();
  }, [employees]);

  return (
    <div className="space-y-4">
      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código BIV..."
            value={searchCode}
            onChange={e => { setSearchCode(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>

        <Select value={filterEmployee} onValueChange={v => { setFilterEmployee(v); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Empleado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {employeeNames.map(name => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterAction} onValueChange={v => { setFilterAction(v); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Tipo de acción" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las acciones</SelectItem>
            {Object.entries(ACTION_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" onClick={e => e.stopPropagation()} className={cn("w-full sm:w-[150px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFrom ? format(dateFrom, 'dd/MM/yy') : 'Desde'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateFrom} onSelect={d => { setDateFrom(d); setPage(0); }} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" onClick={e => e.stopPropagation()} className={cn("w-full sm:w-[150px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateTo ? format(dateTo, 'dd/MM/yy') : 'Hasta'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateTo} onSelect={d => { setDateTo(d); setPage(0); }} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>

        <Button variant="outline" onClick={exportCSV} disabled={!logs.length} className="gap-2">
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Código</TableHead>
              <TableHead>Fecha y hora</TableHead>
              <TableHead>Empleado</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead className="min-w-[250px]">Descripción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Cargando...</TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No hay registros de auditoría</TableCell>
              </TableRow>
            ) : (
              logs.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs">{log.code}</span>
                      <button onClick={() => copyCode(log.code)} className="text-muted-foreground hover:text-foreground transition-colors">
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                  </TableCell>
                  <TableCell className="text-sm">{log.user_name || '—'}</TableCell>
                  <TableCell className="text-xs capitalize">{log.user_role || '—'}</TableCell>
                  <TableCell>
                    <span className="text-xs font-medium">{ACTION_LABELS[log.action_type] || log.action_type}</span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">{log.action_description}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{totalCount} registros — Página {page + 1} de {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BitacoraTab;
