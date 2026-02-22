import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Loader2, AlertTriangle, Pencil, Download, CalendarIcon,
  Clock, TrendingUp, UserCheck, ChevronLeft, ChevronRight,
} from 'lucide-react';

const PAGE_SIZE = 20;

const CIERRE_LABELS: Record<string, string> = {
  manual: 'Manual',
  automatico_horario: 'Auto (horario)',
  automatico_inactividad: 'Auto (inactividad)',
  automatico_medianoche: 'Auto (medianoche)',
  gerente: 'Gerente',
};

const HistorialJornadasTab = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const businessId = profile?.business_id;

  // Filters
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [soloIncidencias, setSoloIncidencias] = useState(false);
  const [page, setPage] = useState(0);

  // Edit note dialog
  const [editNote, setEditNote] = useState<{ id: string; notas: string } | null>(null);
  const [notaText, setNotaText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Fetch profiles for filter dropdown
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-for-jornadas', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('business_id', businessId)
        .order('full_name');
      return data || [];
    },
    enabled: !!businessId,
  });

  // Fetch branches for display
  const { data: branchMap = {} } = useQuery({
    queryKey: ['branches-map', businessId],
    queryFn: async () => {
      if (!businessId) return {};
      const { data } = await supabase
        .from('branches')
        .select('id, name')
        .eq('business_id', businessId);
      const map: Record<string, string> = {};
      data?.forEach(b => { map[b.id] = b.name; });
      return map;
    },
    enabled: !!businessId,
  });

  // Fetch jornadas
  const { data: allJornadas = [], isLoading } = useQuery({
    queryKey: ['historial-jornadas', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data: branches } = await supabase
        .from('branches')
        .select('id')
        .eq('business_id', businessId);
      if (!branches?.length) return [];

      const branchIds = branches.map(b => b.id);
      const { data, error } = await supabase
        .from('jornadas')
        .select('*')
        .in('sucursal_id', branchIds)
        .order('apertura_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!businessId,
  });

  const profileMap = useMemo(() => {
    const m: Record<string, string> = {};
    profiles.forEach(p => { m[p.id] = p.full_name; });
    return m;
  }, [profiles]);

  // Filter jornadas
  const filtered = useMemo(() => {
    return allJornadas.filter(j => {
      if (filterEmployee !== 'all' && j.empleado_id !== filterEmployee) return false;
      if (soloIncidencias && !j.incidencia) return false;
      if (dateFrom) {
        const jDate = new Date(j.apertura_at);
        if (jDate < dateFrom) return false;
      }
      if (dateTo) {
        const jDate = new Date(j.apertura_at);
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (jDate > endOfDay) return false;
      }
      return true;
    });
  }, [allJornadas, filterEmployee, dateFrom, dateTo, soloIncidencias]);

  // Paginate
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Stats
  const stats = useMemo(() => {
    const totalMin = filtered.reduce((s, j) => s + (j.duracion_min || 0), 0);
    const withDuration = filtered.filter(j => j.duracion_min != null);
    const avgMin = withDuration.length > 0 ? totalMin / withDuration.length : 0;
    const incidencias = filtered.filter(j => j.incidencia).length;

    // Employee with most hours
    const byEmployee: Record<string, number> = {};
    filtered.forEach(j => {
      if (j.duracion_min) {
        byEmployee[j.empleado_id] = (byEmployee[j.empleado_id] || 0) + j.duracion_min;
      }
    });
    let topEmployee = { name: '—', hours: 0 };
    Object.entries(byEmployee).forEach(([empId, mins]) => {
      if (mins > topEmployee.hours * 60) {
        topEmployee = { name: profileMap[empId] || 'Desconocido', hours: mins / 60 };
      }
    });
    // Fix: compare mins properly
    let maxMins = 0;
    let maxEmpId = '';
    Object.entries(byEmployee).forEach(([empId, mins]) => {
      if (mins > maxMins) {
        maxMins = mins;
        maxEmpId = empId;
      }
    });
    topEmployee = { name: profileMap[maxEmpId] || '—', hours: maxMins / 60 };

    return {
      totalHours: (totalMin / 60).toFixed(1),
      avgHours: (avgMin / 60).toFixed(1),
      incidencias,
      topEmployee,
    };
  }, [filtered, profileMap]);

  const handleSaveNote = async () => {
    if (!editNote) return;
    setSavingNote(true);
    const { error } = await supabase
      .from('jornadas')
      .update({ notas: notaText || null })
      .eq('id', editNote.id);
    setSavingNote(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Nota actualizada');
      queryClient.invalidateQueries({ queryKey: ['historial-jornadas'] });
      setEditNote(null);
    }
  };

  const exportCSV = () => {
    const headers = ['Empleado', 'Sucursal', 'Entrada', 'Salida', 'Duración (min)', 'Método cierre', 'Incidencia', 'Notas'];
    const rows = filtered.map(j => [
      profileMap[j.empleado_id] || j.empleado_id,
      branchMap[j.sucursal_id] || j.sucursal_id,
      j.apertura_at,
      j.cierre_at || '',
      j.duracion_min?.toString() || '',
      j.metodo_cierre || '',
      j.incidencia ? 'Sí' : 'No',
      (j.notas || '').replace(/"/g, '""'),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historial-jornadas-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return '—';
    return format(new Date(iso), 'dd/MM/yy HH:mm', { locale: es });
  };

  const formatDuration = (min: number | null) => {
    if (min == null) return '—';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Total horas</p>
              <p className="text-lg font-bold">{stats.totalHours}h</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Promedio/jornada</p>
              <p className="text-lg font-bold">{stats.avgHours}h</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-warning shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Incidencias</p>
              <p className="text-lg font-bold">{stats.incidencias}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <UserCheck className="h-8 w-8 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Más horas</p>
              <p className="text-sm font-bold truncate">{stats.topEmployee.name}</p>
              <p className="text-[10px] text-muted-foreground">{stats.topEmployee.hours.toFixed(1)}h</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Empleado</Label>
          <Select value={filterEmployee} onValueChange={v => { setFilterEmployee(v); setPage(0); }}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {profiles.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Desde</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[130px] h-8 text-xs justify-start", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="h-3 w-3 mr-1" />
                {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Inicio'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={d => { setDateFrom(d); setPage(0); }} className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Hasta</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[130px] h-8 text-xs justify-start", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="h-3 w-3 mr-1" />
                {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'Fin'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={d => { setDateTo(d); setPage(0); }} className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-center gap-2 pb-0.5">
          <Checkbox id="solo-inc" checked={soloIncidencias} onCheckedChange={v => { setSoloIncidencias(!!v); setPage(0); }} />
          <Label htmlFor="solo-inc" className="text-xs cursor-pointer">Solo incidencias</Label>
        </div>

        <Button variant="outline" size="sm" className="h-8 text-xs ml-auto" onClick={exportCSV}>
          <Download className="h-3 w-3 mr-1" />
          Exportar CSV
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {paginated.map(j => (
              <div
                key={j.id}
                className={cn(
                  'border rounded-lg p-3 space-y-1',
                  j.incidencia && 'bg-warning/10 border-warning/30'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{profileMap[j.empleado_id] || '—'}</span>
                  {j.incidencia && <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
                </div>
                <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
                  <span>Entrada: {formatTime(j.apertura_at)}</span>
                  <span>Salida: {formatTime(j.cierre_at)}</span>
                  <span>Duración: {formatDuration(j.duracion_min)}</span>
                  <span>Cierre: {CIERRE_LABELS[j.metodo_cierre || ''] || j.metodo_cierre || '—'}</span>
                </div>
                {j.notas && <p className="text-[11px] text-muted-foreground italic">{j.notas}</p>}
                {j.incidencia && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => { setEditNote({ id: j.id, notas: j.notas || '' }); setNotaText(j.notas || ''); }}
                  >
                    <Pencil className="h-3 w-3 mr-1" />Editar nota
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Salida</TableHead>
                  <TableHead>Duración</TableHead>
                  <TableHead>Cierre</TableHead>
                  <TableHead>Incidencia</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map(j => (
                  <TableRow key={j.id} className={cn(j.incidencia && 'bg-warning/5')}>
                    <TableCell className="font-medium">{profileMap[j.empleado_id] || '—'}</TableCell>
                    <TableCell>{branchMap[j.sucursal_id] || '—'}</TableCell>
                    <TableCell>{formatTime(j.apertura_at)}</TableCell>
                    <TableCell>{formatTime(j.cierre_at)}</TableCell>
                    <TableCell>{formatDuration(j.duracion_min)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {CIERRE_LABELS[j.metodo_cierre || ''] || j.metodo_cierre || '—'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {j.incidencia ? (
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                          <span className="text-xs">Sí</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {j.incidencia && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => { setEditNote({ id: j.id, notas: j.notas || '' }); setNotaText(j.notas || ''); }}
                          title="Editar nota"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {paginated.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No se encontraron jornadas con los filtros seleccionados
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                {filtered.length} jornadas · Página {page + 1} de {totalPages}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit note dialog */}
      <Dialog open={!!editNote} onOpenChange={o => { if (!o) setEditNote(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar nota de incidencia</DialogTitle>
          </DialogHeader>
          <Textarea
            value={notaText}
            onChange={e => setNotaText(e.target.value)}
            placeholder="Escribe una nota sobre esta incidencia..."
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditNote(null)}>Cancelar</Button>
            <Button onClick={handleSaveNote} disabled={savingNote}>
              {savingNote ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HistorialJornadasTab;
