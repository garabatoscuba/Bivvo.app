import { Calendar, TrendingUp } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
  /** matrix[day][hour] for last 7 days; index 6 is today */
  matrix?: number[][];
}

// Build a sensible mock if data is not yet wired
const buildMock = (): number[][] => {
  const base = [0,0,0,0,0,0,1,2,3,3,4,5,6,7,5,4,3,3,4,3,2,1,1,0];
  return Array.from({ length: 7 }, (_, d) =>
    base.map((v) => Math.max(0, v + (d === 6 ? 1 : 0) - (d === 5 ? 2 : 0)))
  );
};

const levelFor = (v: number) => {
  if (v <= 0) return 0;
  if (v <= 2) return 1;
  if (v <= 4) return 2;
  if (v <= 6) return 3;
  return 4;
};

const cellBg = (lvl: number) => {
  switch (lvl) {
    case 0: return 'rgba(255,255,255,0.035)';
    case 1: return 'rgba(16,217,160,0.14)';
    case 2: return 'rgba(16,217,160,0.30)';
    case 3: return 'rgba(16,217,160,0.55)';
    default: return 'var(--te-brand)';
  }
};

const WeeklyHeatmap = ({ matrix }: Props) => {
  const data = matrix && matrix.length === 7 ? matrix : buildMock();
  const dayLabels = Array.from({ length: 7 }, (_, i) =>
    i === 6 ? 'hoy' : format(subDays(new Date(), 6 - i), 'EEE d', { locale: es }).toLowerCase()
  );
  const totals = data.map((row) => row.reduce((a, b) => a + b, 0));
  const maxTotal = Math.max(...totals);
  const totalSales = totals.reduce((a, b) => a + b, 0);

  // Pico de hoy
  const todayRow = data[6] || [];
  let peakHour = 0;
  let peakVal = -1;
  todayRow.forEach((v, h) => { if (v > peakVal) { peakVal = v; peakHour = h; } });

  // Insight
  const bestDayIdx = totals.indexOf(maxTotal);
  const bestDayLabel = bestDayIdx === 6 ? 'hoy' : format(subDays(new Date(), 6 - bestDayIdx), 'EEEE', { locale: es });

  return (
    <section className="overflow-hidden flex flex-col rounded-[var(--te-r-lg)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] mb-5">
      <div className="flex items-center justify-between pt-[18px] px-[22px] pb-3.5">
        <div className="flex items-center gap-2.5 text-[14.5px] font-semibold text-[var(--te-text-primary)]">
          <div className="w-7 h-7 flex items-center justify-center rounded-[var(--te-r-sm)] bg-[var(--bg-surface-elevated)] text-[var(--te-text-secondary)]">
            <Calendar className="w-3.5 h-3.5" strokeWidth={1.8} />
          </div>
          Patrón de la semana
        </div>
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--te-brand-soft)] text-[var(--te-brand)] rounded-full font-medium text-[11.5px]"
        >
          <TrendingUp className="w-[11px] h-[11px]" strokeWidth={2.2} />
          Pico: hoy a las {String(peakHour).padStart(2, '0')}:00
        </div>
      </div>

      <div className="px-6 pb-6">
        <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
          <div className="flex items-baseline gap-3 text-[12.5px] text-[var(--te-text-tertiary)]">
            <span>Cada celda es 1 hora · más vibrante, más ventas</span>
            <span>·</span>
            <span>
              <strong className="text-[var(--te-text-secondary)] font-medium tabular-nums">{totalSales}</strong> ventas en 7 días
            </span>
          </div>
          <div className="te-font-mono flex items-center gap-2 text-[10.5px] text-[var(--te-text-tertiary)] tracking-[0.3px]">
            <span>menos</span>
            <div className="flex gap-0.5">
              {[0,1,2,3,4].map((lvl) => (
                <div
                  key={lvl}
                  style={{
                    width: 13, height: 13, borderRadius: 2.5,
                    background: cellBg(lvl),
                    border: lvl === 0 ? '1px solid var(--border-subtle)' : undefined,
                  }}
                />
              ))}
            </div>
            <span>más</span>
          </div>
        </div>

        <div
          className="grid items-center"
          style={{ gridTemplateColumns: '56px 1fr 62px', columnGap: 12, rowGap: 5 }}
        >
          {data.map((row, dIdx) => {
            const isToday = dIdx === 6;
            const isPeak = totals[dIdx] === maxTotal && !isToday;
            return (
              <div key={dIdx} className="contents">
                <div
                  className={`text-[11px] tracking-[0.4px] uppercase text-right font-medium tabular-nums ${
                    isToday ? 'text-[var(--te-brand)] font-semibold' : 'text-[var(--te-text-tertiary)]'
                  }`}
                >
                  {dayLabels[dIdx]}
                </div>
                <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}>
                  {row.map((v, h) => {
                    const lvl = levelFor(v);
                    return (
                      <div
                        key={h}
                        title={`${dayLabels[dIdx]} · ${String(h).padStart(2,'0')}:00 · ${v} ventas`}
                        className="hover:scale-[1.35] hover:z-10 hover:shadow-[0_0_0_1px_var(--te-brand),0_4px_12px_rgba(16,217,160,0.35)]"
                        style={{
                          aspectRatio: '1',
                          width: '88%',
                          margin: '0 auto',
                          borderRadius: 2.5,
                          background: cellBg(lvl),
                          border: lvl === 0 ? '1px solid var(--border-subtle)' : undefined,
                          cursor: 'pointer',
                          transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                          willChange: 'transform',
                        }}
                      />
                    );
                  })}
                </div>
                <div
                  className={`te-font-mono text-right text-[12px] tabular-nums font-medium ${
                    isToday ? 'text-[var(--te-brand)] font-semibold' : 'text-[var(--te-text-secondary)]'
                  }`}
                >
                  {isPeak && <span className="text-[var(--te-brand)] mr-0.5">↑</span>}
                  {totals[dIdx]}
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="grid mt-3.5 pt-3 border-t border-[var(--border-subtle)]"
          style={{ gridTemplateColumns: '56px 1fr 62px', columnGap: 12 }}
        >
          <div className="text-[10px] text-[var(--te-text-quaternary)] tracking-[0.6px] uppercase text-right font-medium">
            hora
          </div>
          <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}>
            {Array.from({ length: 24 }).map((_, h) => {
              const show = h % 3 === 0;
              const isPeak = h === peakHour;
              return (
                <span
                  key={h}
                  className={`text-center text-[9.5px] tabular-nums ${
                    show ? 'opacity-100' : 'opacity-0'
                  } ${isPeak ? 'text-[var(--te-brand)] font-semibold' : 'text-[var(--te-text-quaternary)]'}`}
                >
                  {String(h).padStart(2, '0')}
                </span>
              );
            })}
          </div>
          <div className="text-[10px] text-[var(--te-text-quaternary)] tracking-[0.6px] uppercase text-right font-medium">
            total
          </div>
        </div>

        <div
          className="mt-[18px] py-3.5 px-4 rounded-[var(--te-r-md)] bg-[var(--bg-surface-elevated)] text-[13.5px] text-[var(--te-text-primary)] leading-[1.5]"
          style={{ borderLeft: '2px solid var(--te-brand)' }}
        >
          Tu patrón es <strong className="font-semibold text-[var(--te-brand)]">consistente</strong>: el almuerzo concentra el día. Tu mejor día fue el{' '}
          <em className="not-italic font-semibold text-[var(--te-brand)]">{bestDayLabel}</em> con{' '}
          <strong className="font-semibold text-[var(--te-brand)]">{maxTotal} ventas</strong>.
        </div>
      </div>
    </section>
  );
};

export default WeeklyHeatmap;
