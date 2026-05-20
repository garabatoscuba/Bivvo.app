import { useMemo, useState } from 'react';
import { Calendar } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, ReferenceLine } from 'recharts';

interface Props {
  /** 7x24 matrix; row 6 = today */
  matrix?: number[][];
}

type Range = 'hoy' | '7d' | '30d';

const MobileHourlyChart = ({ matrix }: Props) => {
  const [range, setRange] = useState<Range>('hoy');

  const hourly = useMemo(() => {
    const arr = Array(24).fill(0) as number[];
    if (!matrix || matrix.length === 0) return arr;
    if (range === 'hoy') {
      const today = matrix[6] || [];
      today.forEach((v, h) => (arr[h] = v));
    } else {
      // 7d y 30d: por ahora solo tenemos 7 días reales; mostramos el mismo agregado
      matrix.forEach((row) => row.forEach((v, h) => (arr[h] += v)));
    }
    return arr;
  }, [matrix, range]);

  const data = hourly.map((v, h) => ({ hour: h, value: v }));
  const total = hourly.reduce((a, b) => a + b, 0);

  let peakHour = 0;
  let peakVal = -1;
  hourly.forEach((v, h) => { if (v > peakVal) { peakVal = v; peakHour = h; } });

  const tabs: { id: Range; label: string }[] = [
    { id: 'hoy', label: 'Hoy' },
    { id: '7d', label: '7 días' },
    { id: '30d', label: '30 días' },
  ];

  return (
    <section className="overflow-hidden flex flex-col rounded-[var(--te-r-lg)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] mb-4">
      <div className="flex items-center justify-between pt-3.5 px-3.5 pb-2.5 gap-2">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--te-text-primary)] min-w-0">
          <div className="w-6 h-6 flex items-center justify-center rounded-[var(--te-r-sm)] bg-[var(--bg-surface-elevated)] text-[var(--te-text-secondary)] shrink-0">
            <Calendar className="w-3 h-3" strokeWidth={1.8} />
          </div>
          <span className="truncate">Actividad por hora</span>
        </div>
        <span className="te-font-mono text-[10.5px] text-[var(--te-text-tertiary)] tabular-nums whitespace-nowrap">
          {total} ventas
        </span>
      </div>

      <div className="px-3.5 pb-2">
        <div className="inline-flex gap-1 p-0.5 rounded-[var(--te-r-md)] bg-[var(--bg-surface-elevated)]">
          {tabs.map((t) => {
            const active = range === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setRange(t.id)}
                className={`px-2.5 py-1 rounded-[6px] text-[11.5px] font-medium transition-colors ${
                  active
                    ? 'bg-[var(--te-brand)] text-[var(--te-brand-text)]'
                    : 'text-[var(--te-text-tertiary)]'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-1 pb-3">
        <div className="relative" style={{ height: 170 }}>
          {peakVal > 0 && (
            <div
              className="absolute z-10 pointer-events-none te-font-serif italic text-[11.5px] text-[var(--te-text-secondary)] whitespace-nowrap"
              style={{
                left: `${(peakHour / 23) * 100}%`,
                transform: 'translate(-50%, 0)',
                top: 2,
              }}
            >
              Pico a las{' '}
              <strong className="not-italic font-semibold text-[var(--te-brand)] te-font-mono">
                {String(peakHour).padStart(2, '0')}:00
              </strong>
            </div>
          )}
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 26, right: 14, left: 14, bottom: 4 }}>
              <defs>
                <linearGradient id="mobileHourlyFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10D9A0" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#10D9A0" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="hour"
                ticks={[0, 6, 12, 18, 23]}
                tickFormatter={(h) => (h === 23 ? '23:59' : `${String(h).padStart(2, '0')}:00`)}
                tick={{ fill: 'var(--te-text-quaternary)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide domain={[0, (dataMax: number) => Math.max(2, dataMax * 1.25)]} />
              {peakVal > 0 && (
                <ReferenceLine
                  x={peakHour}
                  stroke="#10D9A0"
                  strokeOpacity={0.45}
                  strokeDasharray="2 3"
                />
              )}
              <Area
                type="monotone"
                dataKey="value"
                stroke="#10D9A0"
                strokeWidth={2}
                fill="url(#mobileHourlyFill)"
                isAnimationActive={false}
                activeDot={{ r: 4, fill: '#10D9A0', stroke: 'transparent' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
};

export default MobileHourlyChart;
