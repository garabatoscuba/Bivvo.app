import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowUp, ArrowDown, ArrowUpDown, Users } from 'lucide-react';
import type { EmployeeReport } from '@/hooks/useReportData';

type SortKey = 'name' | 'salesCount' | 'servicesCount' | 'totalCollected' | 'tips' | 'estimatedSalary';
type SortDir = 'asc' | 'desc';

const ReportesPorEmpleadoTab = ({ employees }: { employees: EmployeeReport[] }) => {
  const [sortKey, setSortKey] = useState<SortKey>('totalCollected');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey(prev => {
      if (prev === key) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return key; }
      setSortDir('desc');
      return key;
    });
  }, []);

  const sorted = useMemo(() => {
    const arr = [...employees];
    arr.sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey];
      if (typeof va === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      }
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return arr;
  }, [employees, sortKey, sortDir]);

  const SortableHead = ({ label, k, className }: { label: string; k: SortKey; className?: string }) => (
    <TableHead className={`cursor-pointer select-none hover:text-foreground ${className || ''}`} onClick={() => toggleSort(k)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === k ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
      </span>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {sorted.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Sin datos de empleados en este período</p>
        ) : sorted.map(emp => (
          <Card key={emp.id}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">{emp.name}</span>
                <span className="text-xs text-muted-foreground">{emp.salesCount + emp.servicesCount} trans.</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Recaudado</span><p className="font-bold">${emp.totalCollected.toFixed(2)}</p></div>
                <div><span className="text-muted-foreground">Salario Est.</span><p className="font-bold text-primary">${emp.estimatedSalary.toFixed(2)}</p></div>
                <div><span className="text-muted-foreground">Propinas</span><p className="font-bold">${emp.tips.toFixed(2)}</p></div>
                <div><span className="text-muted-foreground">Ventas/Serv.</span><p className="font-bold">{emp.salesCount} / {emp.servicesCount}</p></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop table */}
      <div className="border rounded-md hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Empleado" k="name" />
              <SortableHead label="Ventas" k="salesCount" className="text-center" />
              <SortableHead label="Servicios" k="servicesCount" className="text-center" />
              <SortableHead label="Recaudado" k="totalCollected" className="text-right" />
              <SortableHead label="Propinas" k="tips" className="text-right" />
              <SortableHead label="Salario Est." k="estimatedSalary" className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin datos de empleados</TableCell></TableRow>
            ) : sorted.map(emp => (
              <TableRow key={emp.id}>
                <TableCell className="font-medium">{emp.name}</TableCell>
                <TableCell className="text-center">{emp.salesCount}</TableCell>
                <TableCell className="text-center">{emp.servicesCount}</TableCell>
                <TableCell className="text-right font-medium">${emp.totalCollected.toFixed(2)}</TableCell>
                <TableCell className="text-right">${emp.tips.toFixed(2)}</TableCell>
                <TableCell className="text-right font-bold text-primary">${emp.estimatedSalary.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ReportesPorEmpleadoTab;
