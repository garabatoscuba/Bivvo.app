import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, ShoppingCart, Wrench, TrendingUp, CreditCard, Hash, PackageX } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { ReportEntry, MermaEntry } from '@/hooks/useReportData';
import { rechartsTooltipStyle } from '@/lib/chartStyles';

interface Props {
  sales: ReportEntry[];
  services: ReportEntry[];
  all: ReportEntry[];
  dailyBreakdown: { label: string; ventas: number; servicios: number }[];
  mermas?: MermaEntry[];
}

const paymentLabels: Record<string, string> = {
  cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta', credit: 'Crédito', mixed: 'Mixto',
};

const ReportesResumenTab = ({ sales, services, all, dailyBreakdown, mermas = [] }: Props) => {
  const totalRecaudado = all.reduce((s, e) => s + e.total, 0);
  const totalVentas = sales.reduce((s, e) => s + e.total, 0);
  const totalServicios = services.reduce((s, e) => s + e.total, 0);
  const transacciones = all.length;
  const ticketPromedio = transacciones > 0 ? totalRecaudado / transacciones : 0;
  const totalMermas = mermas.reduce((s, m) => s + m.cost_value, 0);
  const mermasCount = mermas.length;

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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Ventas vs Servicios por día</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin datos en este período</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dailyBreakdown}>
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} {...rechartsTooltipStyle} />
                <Legend />
                <Bar dataKey="ventas" name="Ventas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="servicios" name="Servicios" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportesResumenTab;
