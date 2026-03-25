import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { ReportEntry } from '@/hooks/useReportData';
import { rechartsTooltipStyle } from '@/lib/chartStyles';

interface Props {
  sales: ReportEntry[];
  services: ReportEntry[];
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))'];

const ReportesVsTab = ({ sales, services }: Props) => {
  const totalVentas = sales.reduce((s, e) => s + e.total, 0);
  const totalServicios = services.reduce((s, e) => s + e.total, 0);
  const grandTotal = totalVentas + totalServicios;

  const pctVentas = grandTotal > 0 ? (totalVentas / grandTotal * 100) : 0;
  const pctServicios = grandTotal > 0 ? (totalServicios / grandTotal * 100) : 0;

  const avgVenta = sales.length > 0 ? totalVentas / sales.length : 0;
  const avgServicio = services.length > 0 ? totalServicios / services.length : 0;

  const donutData = useMemo(() => [
    { name: 'Ventas', value: totalVentas },
    { name: 'Servicios', value: totalServicios },
  ], [totalVentas, totalServicios]);

  const rows = [
    { label: 'Monto Total', v: `$${totalVentas.toFixed(2)}`, s: `$${totalServicios.toFixed(2)}` },
    { label: 'Cantidad', v: sales.length.toString(), s: services.length.toString() },
    { label: 'Promedio/Trans.', v: `$${avgVenta.toFixed(2)}`, s: `$${avgServicio.toFixed(2)}` },
    { label: '% del Total', v: `${pctVentas.toFixed(1)}%`, s: `${pctServicios.toFixed(1)}%` },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Side by side comparison */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Desglose</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {rows.map(row => (
                <div key={row.label} className="grid grid-cols-3 gap-2 text-sm">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-bold text-center">{row.v}</span>
                  <span className="font-bold text-center">{row.s}</span>
                </div>
              ))}
              {/* Header labels */}
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground border-t pt-2 -order-1">
                <span></span>
                <span className="text-center font-medium">Ventas</span>
                <span className="text-center font-medium">Servicios</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Donut chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Proporción</CardTitle>
          </CardHeader>
          <CardContent>
            {grandTotal === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                    {donutData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} {...rechartsTooltipStyle} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReportesVsTab;
