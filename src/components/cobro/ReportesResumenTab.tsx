import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, ShoppingCart, Wrench, TrendingUp, CreditCard, Hash, PackageX, ChevronDown, Wallet, TrendingDown, BarChart3, Users } from 'lucide-react';
import type { ReportEntry, MermaEntry, EmployeeReport } from '@/hooks/useReportData';

interface ExpenseEntry { id: string; created_at: string; amount: number }
interface SalaryEntry { id: string; created_at: string; amount: number }

interface Props {
  sales: ReportEntry[];
  services: ReportEntry[];
  all: ReportEntry[];
  dailyBreakdown: { label: string; ventas: number; servicios: number }[];
  mermas?: MermaEntry[];
  expenses?: ExpenseEntry[];
  salaries?: SalaryEntry[];
  employees?: EmployeeReport[];
}

const paymentLabels: Record<string, string> = {
  cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta', credit: 'Crédito', mixed: 'Mixto',
};

const ReportesResumenTab = ({ sales, services, all, mermas = [], expenses = [], salaries = [], employees = [] }: Props) => {
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [employeeOpen, setEmployeeOpen] = useState(false);

  const totalRecaudado = all.reduce((s, e) => s + e.total, 0);
  const totalVentas = sales.reduce((s, e) => s + e.total, 0);
  const totalServicios = services.reduce((s, e) => s + e.total, 0);
  const transacciones = all.length;
  const ticketPromedio = transacciones > 0 ? totalRecaudado / transacciones : 0;
  const totalMermas = mermas.reduce((s, m) => s + m.cost_value, 0);
  const mermasCount = mermas.length;

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalSalaries = salaries.reduce((s, e) => s + e.amount, 0);
  const totalGastado = totalExpenses + totalSalaries;
  const gananciaNeta = totalRecaudado - totalGastado;

  const metodoPago = useMemo(() => {
    const counts: Record<string, number> = {};
    all.forEach(e => { counts[e.payment_type] = (counts[e.payment_type] || 0) + 1; });
    let max = '', maxCount = 0;
    Object.entries(counts).forEach(([k, v]) => { if (v > maxCount) { max = k; maxCount = v; } });
    return paymentLabels[max] || max || '—';
  }, [all]);

  const kpis = [
    { label: 'Total Recaudado', value: `$${totalRecaudado.toFixed(2)}`, icon: DollarSign },
    { label: 'Total Ventas', value: `$${totalVentas.toFixed(2)}`, icon: ShoppingCart },
    { label: 'Total Servicios', value: `$${totalServicios.toFixed(2)}`, icon: Wrench },
    { label: 'Transacciones', value: transacciones.toString(), icon: Hash },
    { label: 'Ticket Promedio', value: `$${ticketPromedio.toFixed(2)}`, icon: TrendingUp },
    { label: 'Método más usado', value: metodoPago, icon: CreditCard },
    { label: `Mermas (${mermasCount})`, value: `−$${totalMermas.toFixed(2)}`, icon: PackageX, destructive: true },
  ];

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
        {kpis.map(kpi => (
          <Card key={kpi.label} className={(kpi as any).destructive ? 'border-destructive/30' : ''}>
            <CardHeader className="flex flex-row items-center justify-between pb-1 p-3 md:p-6 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className={`h-3.5 w-3.5 md:h-4 md:w-4 ${(kpi as any).destructive ? 'text-destructive' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              <div className={`text-lg md:text-2xl font-bold ${(kpi as any).destructive ? 'text-destructive' : ''}`}>{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Financial Summary */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          Resumen financiero
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-1 p-3 md:p-6 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Total cobrado</CardTitle>
              <Wallet className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              <div className="text-xl md:text-3xl font-bold">${totalRecaudado.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-1 p-3 md:p-6 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Total gastado</CardTitle>
              <TrendingDown className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              <div className="text-xl md:text-3xl font-bold">${totalGastado.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card className={gananciaNeta >= 0 ? 'border-success/30' : 'border-destructive/30'}>
            <CardHeader className="flex flex-row items-center justify-between pb-1 p-3 md:p-6 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Ganancia neta estimada</CardTitle>
              <TrendingUp className={`h-3.5 w-3.5 md:h-4 md:w-4 ${gananciaNeta >= 0 ? 'text-success' : 'text-destructive'}`} />
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              <div className={`text-xl md:text-3xl font-bold ${gananciaNeta >= 0 ? 'text-success' : 'text-destructive'}`}>
                {gananciaNeta < 0 ? '−' : ''}${Math.abs(gananciaNeta).toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Collapsible breakdown */}
        <Collapsible open={breakdownOpen} onOpenChange={setBreakdownOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full">
            <ChevronDown className={`h-4 w-4 transition-transform ${breakdownOpen ? 'rotate-180' : ''}`} />
            Ver desglose
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <Card>
              <CardContent className="p-3 md:p-6 space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">De dónde viene lo cobrado</p>
                  <div className="flex justify-between text-sm">
                    <span>Ventas</span>
                    <span className="font-medium">${totalVentas.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Servicios</span>
                    <span className="font-medium">${totalServicios.toFixed(2)}</span>
                  </div>
                </div>
                <div className="border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">De dónde vienen los gastos</p>
                  <div className="flex justify-between text-sm">
                    <span>Salarios</span>
                    <span className="font-medium">${totalSalaries.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Otros gastos</span>
                    <span className="font-medium">${totalExpenses.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* Collapsible employee breakdown */}
        {employees.length > 0 && (
          <Collapsible open={employeeOpen} onOpenChange={setEmployeeOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full">
              <ChevronDown className={`h-4 w-4 transition-transform ${employeeOpen ? 'rotate-180' : ''}`} />
              <Users className="h-4 w-4" />
              Por empleado
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <Card>
                <CardContent className="p-0 md:p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Nombre</TableHead>
                          <TableHead className="text-xs text-right">Cobró</TableHead>
                          <TableHead className="text-xs text-right">Salario</TableHead>
                          <TableHead className="text-xs text-right">Propinas</TableHead>
                          <TableHead className="text-xs text-right">Entrega</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employees.map(emp => {
                          const entrega = emp.totalCollected - emp.estimatedSalary;
                          return (
                            <TableRow key={emp.id}>
                              <TableCell className="text-sm font-medium py-2 px-3">{emp.name}</TableCell>
                              <TableCell className="text-sm text-right py-2 px-3">${emp.totalCollected.toFixed(2)}</TableCell>
                              <TableCell className="text-sm text-right py-2 px-3">${emp.estimatedSalary.toFixed(2)}</TableCell>
                              <TableCell className="text-sm text-right py-2 px-3">${emp.tips.toFixed(2)}</TableCell>
                              <TableCell className={`text-sm text-right py-2 px-3 font-medium ${entrega >= 0 ? 'text-success' : 'text-destructive'}`}>
                                {entrega < 0 ? '−' : ''}${Math.abs(entrega).toFixed(2)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
};

export default ReportesResumenTab;
