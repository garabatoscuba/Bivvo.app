import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ReportEntry } from '@/hooks/useReportData';

interface Props {
  currentAll: ReportEntry[];
  prevAll: ReportEntry[];
  currentSales: ReportEntry[];
  prevSales: ReportEntry[];
  currentServices: ReportEntry[];
  prevServices: ReportEntry[];
  periodLabel: string;
  prevLabel: string;
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function Indicator({ current, previous, format: fmt }: { current: number; previous: number; format: (n: number) => string }) {
  const change = pctChange(current, previous);
  const isUp = change > 0;
  const isDown = change < 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-lg md:text-2xl font-bold">{fmt(current)}</span>
        <div className={`flex items-center gap-1 text-sm font-medium ${isUp ? 'text-success' : isDown ? 'text-destructive' : 'text-muted-foreground'}`}>
          {isUp ? <TrendingUp className="h-4 w-4" /> : isDown ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
          {Math.abs(change).toFixed(1)}%
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Anterior: {fmt(previous)}</p>
    </div>
  );
}

const periodLabels: Record<string, string> = {
  today: 'Hoy vs Ayer',
  week: 'Esta semana vs Anterior',
  month: 'Este mes vs Anterior',
  year: 'Este año vs Anterior',
};

const ReportesComparativaTab = ({ currentAll, prevAll, currentSales, prevSales, currentServices, prevServices, periodLabel, prevLabel }: Props) => {
  const curTotal = currentAll.reduce((s, e) => s + e.total, 0);
  const prevTotal = prevAll.reduce((s, e) => s + e.total, 0);
  const curSalesTotal = currentSales.reduce((s, e) => s + e.total, 0);
  const prevSalesTotal = prevSales.reduce((s, e) => s + e.total, 0);
  const curServTotal = currentServices.reduce((s, e) => s + e.total, 0);
  const prevServTotal = prevServices.reduce((s, e) => s + e.total, 0);
  const curCount = currentAll.length;
  const prevCount = prevAll.length;
  const curAvg = curCount > 0 ? curTotal / curCount : 0;
  const prevAvg = prevCount > 0 ? prevTotal / prevCount : 0;

  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const fmtN = (n: number) => n.toString();

  const comparisons = [
    { label: 'Total Recaudado', current: curTotal, previous: prevTotal, format: fmt },
    { label: 'Transacciones', current: curCount, previous: prevCount, format: fmtN },
    { label: 'Ticket Promedio', current: curAvg, previous: prevAvg, format: fmt },
    { label: 'Total Ventas', current: curSalesTotal, previous: prevSalesTotal, format: fmt },
    { label: 'Total Servicios', current: curServTotal, previous: prevServTotal, format: fmt },
    { label: 'Nº Ventas', current: currentSales.length, previous: prevSales.length, format: fmtN },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-muted-foreground">{periodLabels[periodLabel] || periodLabel}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {comparisons.map(c => (
          <Card key={c.label}>
            <CardHeader className="pb-1 p-3 md:p-6 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              <Indicator current={c.current} previous={c.previous} format={c.format} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ReportesComparativaTab;
