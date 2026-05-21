import { useMemo } from 'react';
import { Clock, Calendar } from 'lucide-react';
import type { Period } from '@/components/ui/period-filter';

interface SalesPoint { label: string; total: number }

interface Props {
  /** 7x24 matrix; row 6 = today */
  matrix?: number[][];
  /** Buckets ya agregados por useDashboardStats */
  salesOverTime?: SalesPoint[];
  period?: Period;
}

const BRAND = '#10D9A0';
const VB_W = 292;
const VB_H = 130;
const PAD_X = 10;
const PAD_TOP = 30;
const PAD_BOTTOM = 10;

function buildSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
  const d: string[] = [`M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d.push(`C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`);
  }
  return d.join(' ');
}

const DAY_SHORT = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

function periodMeta(period: Period, totalSales: number) {
  switch (period) {
    case 'today':
      return { title: 'Patrón del día', icon: Clock, metaSuffix: 'hoy' };
    case 'week':
      return { title: 'Patrón de la semana', icon: Calendar, metaSuffix: 'en 7 días' };
    case 'month':
      return { title: 'Patrón del mes', icon: Calendar, metaSuffix: 'este mes' };
    case 'year':
      return { title: 'Patrón del año', icon: Calendar, metaSuffix: 'este año' };
  }
}

function axisTicks(period: Period, n: number): { idx: number; label: string }[] {
  switch (period) {
    case 'today':
      return [0, 6, 12, 18, 23].map((i) => ({ idx: i, label: `${String(i).padStart(2, '0')}h` }));
    case 'week':
      return DAY_SHORT.map((label, idx) => ({ idx, label }));
    case 'month': {
      const last = Math.max(0, n - 1);
      const raw = [0, Math.round(last * 0.25), Math.round(last * 0.5), Math.round(last * 0.75), last];
      return raw.map((i) => ({ idx: i, label: String(i + 1) }));
    }
    case 'year': {
      const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      return [0, 3, 6, 9, 11].map((i) => ({ idx: i, label: months[i] }));
    }
  }
}

const fmtInt = (n: number) => new Intl.NumberFormat('es-CU', { maximumFractionDigits: 0 }).format(n);
const fmt1 = (n: number) => new Intl.NumberFormat('es-CU', { maximumFractionDigits: 1 }).format(n);

const MobileHourlyChart = ({ matrix, salesOverTime, period = 'today' }: Props) => {
  const { values, totalCount, peakIdx, peakValue, axis, statLabel, statValue, statUnit, avgLabel, avgValue, avgUnit, peakBubble, insightNode } = useMemo(() => {
    // Build raw series per period
    let series: number[] = [];
    let totalCount = 0;
    let isCountSeries = false;

    if (period === 'today') {
      // Real hourly counts from heatmap matrix
      const today = (matrix && matrix[6]) || Array(24).fill(0);
      series = today.slice(0, 24);
      while (series.length < 24) series.push(0);
      totalCount = series.reduce((a, b) => a + b, 0);
      isCountSeries = true;
    } else {
      series = (salesOverTime || []).map((p) => Number(p.total) || 0);
      if (series.length === 0) series = [0, 0];
      totalCount = series.reduce((a, b) => a + b, 0);
      isCountSeries = false;
    }

    // peak
    let peakIdx = 0;
    let peakValue = -Infinity;
    series.forEach((v, i) => { if (v > peakValue) { peakValue = v; peakIdx = i; } });
    if (peakValue <= 0) { peakValue = 0; peakIdx = Math.floor(series.length / 2); }

    // map to viewBox points
    const n = series.length;
    const max = Math.max(1, ...series);
    const usableW = VB_W - PAD_X * 2;
    const usableH = VB_H - PAD_TOP - PAD_BOTTOM;
    const points = series.map((v, i) => ({
      x: PAD_X + (n === 1 ? usableW / 2 : (i * usableW) / (n - 1)),
      y: PAD_TOP + usableH - (v / max) * usableH,
    }));

    // stats per period
    let statLabel = '', statValue = '', statUnit = '';
    let avgLabel = '', avgValue = '', avgUnit = '';
    let peakBubble: { prefix: string; highlight: string } = { prefix: 'Pico', highlight: '' };
    let insightNode: React.ReactNode = null;
    const labels = salesOverTime || [];

    if (period === 'today') {
      statLabel = 'Hora pico';
      statValue = `${String(peakIdx).padStart(2, '0')}:00`;
      const activeHours = series.filter((v) => v > 0).length || 1;
      const avg = totalCount / activeHours;
      avgLabel = 'Promedio / h';
      avgValue = fmt1(avg);
      avgUnit = 'ventas';
      peakBubble = { prefix: 'Pico a las', highlight: `${String(peakIdx).padStart(2, '0')}:00` };
      insightNode = peakValue > 0 ? (
        <>
          Tu hora más fuerte es <em className="not-italic font-semibold" style={{ color: BRAND }}>las {String(peakIdx).padStart(2, '0')}:00</em> con{' '}
          <strong style={{ color: BRAND }}>{fmtInt(peakValue)} ventas</strong>.
        </>
      ) : (
        <>Aún no hay ventas registradas en el día.</>
      );
    } else if (period === 'week') {
      // labels look like 'lun 12'
      const peakDay = (labels[peakIdx]?.label || '').split(' ')[0] || DAY_SHORT[peakIdx % 7];
      statLabel = 'Mejor día';
      statValue = peakDay.toUpperCase();
      const days = Math.max(1, n);
      avgLabel = 'Promedio / día';
      avgValue = `$${fmtInt(totalCount / days)}`;
      avgUnit = 'CUP';
      peakBubble = { prefix: 'Mejor:', highlight: peakDay };
      insightNode = peakValue > 0 ? (
        <>
          Tu mejor día fue el <em className="not-italic font-semibold" style={{ color: BRAND }}>{peakDay}</em> con{' '}
          <strong style={{ color: BRAND }}>${fmtInt(peakValue)}</strong>.
        </>
      ) : (
        <>Aún no hay ventas registradas en la semana.</>
      );
    } else if (period === 'month') {
      const peakLabel = labels[peakIdx]?.label || String(peakIdx + 1);
      statLabel = 'Mejor día';
      statValue = `D${peakLabel}`;
      avgLabel = 'Promedio / día';
      avgValue = `$${fmtInt(totalCount / Math.max(1, n))}`;
      avgUnit = 'CUP';
      peakBubble = { prefix: 'Pico:', highlight: `día ${peakLabel}` };
      insightNode = peakValue > 0 ? (
        <>
          El <em className="not-italic font-semibold" style={{ color: BRAND }}>día {peakLabel}</em> fue tu mejor momento con{' '}
          <strong style={{ color: BRAND }}>${fmtInt(peakValue)}</strong>.
        </>
      ) : (
        <>Aún no hay ventas registradas este mes.</>
      );
    } else {
      const peakLabel = labels[peakIdx]?.label || '';
      statLabel = 'Mejor mes';
      statValue = peakLabel.toUpperCase();
      avgLabel = 'Promedio / mes';
      avgValue = `$${fmtInt(totalCount / Math.max(1, n))}`;
      avgUnit = 'CUP';
      peakBubble = { prefix: 'Mejor:', highlight: peakLabel };
      insightNode = peakValue > 0 ? (
        <>
          <em className="not-italic font-semibold" style={{ color: BRAND }}>{peakLabel}</em> fue tu mes más fuerte con{' '}
          <strong style={{ color: BRAND }}>${fmtInt(peakValue)}</strong>.
        </>
      ) : (
        <>Aún no hay ventas registradas este año.</>
      );
    }

    return {
      values: points,
      totalCount,
      peakIdx,
      peakValue,
      axis: axisTicks(period, n),
      statLabel, statValue, statUnit,
      avgLabel, avgValue, avgUnit,
      peakBubble,
      insightNode,
      _isCount: isCountSeries,
    };
  }, [matrix, salesOverTime, period]);

  const meta = periodMeta(period, totalCount);
  const Icon = meta.icon;

  // SVG paths
  const linePath = buildSmoothPath(values);
  const areaPath = values.length > 1
    ? `${linePath} L ${values[values.length - 1].x.toFixed(2)},${VB_H} L ${values[0].x.toFixed(2)},${VB_H} Z`
    : '';
  const peak = values[peakIdx] || { x: VB_W / 2, y: PAD_TOP };
  const peakLeftPct = (peak.x / VB_W) * 100;

  // Meta count format
  const isMoney = period !== 'today';
  const metaCount = isMoney ? `$${fmtInt(totalCount)}` : fmtInt(totalCount);
  const metaWord = period === 'today' ? 'ventas' : 'en ventas';

  return (
    <section className="overflow-hidden rounded-[var(--te-r-lg)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] mb-4">
      {/* Header */}
      <div className="flex items-center justify-between pt-3.5 px-3.5 pb-1 gap-2">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--te-text-primary)] min-w-0">
          <div className="w-6 h-6 flex items-center justify-center rounded-[var(--te-r-sm)] bg-[var(--bg-surface-elevated)] text-[var(--te-text-secondary)] shrink-0">
            <Icon className="w-3 h-3" strokeWidth={1.8} />
          </div>
          <span className="truncate">{meta.title}</span>
        </div>
      </div>

      {/* Meta */}
      <div className="px-3.5 pt-2 text-[11px] text-[var(--te-text-tertiary)]">
        <strong className="font-medium tabular-nums text-[var(--te-text-secondary)]">{metaCount}</strong> {metaWord} · {meta.metaSuffix}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-x-3 px-3.5 pt-2.5 pb-3.5 border-b border-[var(--border-subtle)]">
        <div className="flex flex-col gap-[3px]">
          <div className="text-[9.5px] uppercase font-semibold tracking-wider text-[var(--te-text-quaternary)]">{statLabel}</div>
          <div className="flex items-baseline gap-1">
            <span className="text-[22px] font-semibold leading-none tabular-nums" style={{ color: BRAND, letterSpacing: '-0.4px' }}>
              {statValue}
            </span>
            {statUnit && <span className="text-[10.5px] text-[var(--te-text-tertiary)] font-medium">{statUnit}</span>}
          </div>
        </div>
        <div className="flex flex-col gap-[3px]">
          <div className="text-[9.5px] uppercase font-semibold tracking-wider text-[var(--te-text-quaternary)]">{avgLabel}</div>
          <div className="flex items-baseline gap-1">
            <span className="text-[22px] font-semibold leading-none tabular-nums text-[var(--te-text-primary)]" style={{ letterSpacing: '-0.4px' }}>
              {avgValue}
            </span>
            {avgUnit && <span className="text-[10.5px] text-[var(--te-text-tertiary)] font-medium">{avgUnit}</span>}
          </div>
        </div>
      </div>

      {/* Curve */}
      <div className="relative pt-3.5">
        {peakValue > 0 && peakBubble.highlight && (
          <div
            className="absolute z-10 pointer-events-none whitespace-nowrap text-center"
            style={{ top: 4, left: `${Math.max(14, Math.min(86, peakLeftPct))}%`, transform: 'translateX(-50%)' }}
          >
            <span className="te-font-serif italic text-[11px] text-[var(--te-text-secondary)]">
              {peakBubble.prefix}{' '}
              <span className="te-font-sans not-italic font-semibold text-[12.5px] ml-[2px]" style={{ color: BRAND }}>
                {peakBubble.highlight}
              </span>
            </span>
          </div>
        )}
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" className="block w-full" style={{ height: 130, overflow: 'visible' }}>
          <defs>
            <linearGradient id="mobileCurveFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BRAND} stopOpacity={0.32} />
              <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
            </linearGradient>
          </defs>
          {areaPath && <path d={areaPath} fill="url(#mobileCurveFill)" />}
          {linePath && <path d={linePath} fill="none" stroke={BRAND} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
          {peakValue > 0 && (
            <>
              <line x1={peak.x} y1={peak.y} x2={peak.x} y2={VB_H - PAD_BOTTOM + 5} stroke={BRAND} strokeOpacity={0.25} strokeWidth={1} strokeDasharray="2,3" />
              <circle cx={peak.x} cy={peak.y} r={9} fill={BRAND} opacity={0.18} />
              <circle cx={peak.x} cy={peak.y} r={3.5} fill={BRAND} />
            </>
          )}
        </svg>
      </div>

      {/* Axis */}
      <div className="flex justify-between px-3.5 pt-1.5 pb-3 te-font-mono text-[9.5px] text-[var(--te-text-quaternary)]">
        {axis.map((t, i) => (
          <span key={i} className={t.idx === peakIdx ? 'font-semibold' : ''} style={t.idx === peakIdx ? { color: BRAND } : undefined}>
            {t.label}
          </span>
        ))}
      </div>

      {/* Insight */}
      <div className="mx-3.5 mb-3.5 px-3 py-2.5 rounded-[var(--te-r-md)] bg-[var(--bg-surface-elevated)] text-[11.5px] leading-[1.5] text-[var(--te-text-primary)]" style={{ borderLeft: `2px solid ${BRAND}` }}>
        {insightNode}
      </div>
    </section>
  );
};

export default MobileHourlyChart;
