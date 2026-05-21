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
    <section className="overflow-hidden flex flex-col rounded-[var(--te-r-lg)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] mb-4 sm:mb-5">
      <div className="flex items-center justify-between pt-3.5 sm:pt-[18px] px-3.5 sm:px-[22px] pb-3 sm:pb-3.5 gap-2">
        <div className="flex items-center gap-2 sm:gap-2.5 text-[13px] sm:text-[14.5px] font-semibold text-[var(--te-text-primary)] min-w-0">
          <div className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-[var(--te-r-sm)] bg-[var(--bg-surface-elevated)] text-[var(--te-text-secondary)] shrink-0">
            <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" strokeWidth={1.8} />
          </div>
          <span className="truncate">Patrón de la semana</span>
        </div>
        <div
          className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-[var(--te-brand-soft)] text-[var(--te-brand)] rounded-full font-medium text-[10.5px] sm:text-[11.5px] whitespace-nowrap shrink-0"
        >
          <TrendingUp className="w-[10px] h-[10px] sm:w-[11px] sm:h-[11px]" strokeWidth={2.2} />
          <span className="hidden sm:inline">Pico: hoy a las {String(peakHour).padStart(2, '0')}:00</span>
          <span className="sm:hidden">{String(peakHour).padStart(2, '0')}:00</span>
        </div>
      </div>

      <div className="px-3 sm:px-6 pb-4 sm:pb-6">
        <div className="flex items-center justify-between mb-3 sm:mb-5 gap-3 sm:gap-4 flex-wrap">
          <div className="flex items-baseline gap-2 sm:gap-3 text-[11px] sm:text-[12.5px] text-[var(--te-text-tertiary)]">
            <span className="hidden sm:inline">Cada celda es 1 hora · más vibrante, más ventas</span>
            <span className="sm:hidden">1 celda = 1 hora</span>
            <span>·</span>
            <span>
              <strong className="text-[var(--te-text-secondary)] font-medium tabular-nums">{totalSales}</strong> ventas / 7d
            </span>
          </div>
          <div className="te-font-mono flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[10.5px] text-[var(--te-text-tertiary)] tracking-[0.3px]">
            <span>menos</span>
            <div className="flex gap-0.5">
              {[0,1,2,3,4].map((lvl) => (
                <div
                  key={lvl}
                  style={{
                    width: 11, height: 11, borderRadius: 2.5,
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
          className="grid items-center [grid-template-columns:38px_1fr_26px] sm:[grid-template-columns:56px_1fr_62px] gap-x-1.5 sm:gap-x-3 gap-y-1 sm:gap-y-[5px]"
        >
          {data.map((row, dIdx) => {
            const isToday = dIdx === 6;
            const isPeak = totals[dIdx] === maxTotal && !isToday;
            return (
              <div key={dIdx} className="contents">
                <div
                  className={`text-[9.5px] sm:text-[11px] tracking-[0.3px] sm:tracking-[0.4px] uppercase text-right font-medium tabular-nums truncate ${
                    isToday ? 'text-[var(--te-brand)] font-semibold' : 'text-[var(--te-text-tertiary)]'
                  }`}
                >
                  {dayLabels[dIdx]}
                </div>
                <div className="grid gap-[4px] sm:gap-[6px]" style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}>
                  {row.map((v, h) => {
                    const lvl = levelFor(v);
                    const occupied = lvl > 0;
                    return (
                      <div
                        key={h}
                        title={`${dayLabels[dIdx]} · ${String(h).padStart(2,'0')}:00 · ${v} ventas`}
                        className="hover:scale-125 hover:z-10"
                        style={{
                          aspectRatio: '1',
                          width: '100%',
                          maxWidth: 18,
                          justifySelf: 'center',
                          borderRadius: 2,
                          background: cellBg(lvl),
                          border: lvl === 0 ? '1px solid var(--border-subtle)' : undefined,
                          cursor: 'pointer',
                          transition: 'transform 0.18s ease',
                          willChange: 'transform',
                          animation: occupied ? 'fade-in 0.45s ease-out both' : undefined,
                          animationDelay: occupied ? `${(dIdx * 24 + h) * 8}ms` : undefined,
                        }}
                      />
                    );
                  })}
                </div>
                <div
                  className={`te-font-mono text-right text-[10.5px] sm:text-[12px] tabular-nums font-medium ${
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
          className="grid mt-3 sm:mt-3.5 pt-2.5 sm:pt-3 border-t border-[var(--border-subtle)] [grid-template-columns:38px_1fr_26px] sm:[grid-template-columns:56px_1fr_62px] gap-x-1.5 sm:gap-x-3"
        >
          <div className="text-[9px] sm:text-[10px] text-[var(--te-text-quaternary)] tracking-[0.5px] sm:tracking-[0.6px] uppercase text-right font-medium">
            hora
          </div>
          <div className="grid gap-[4px] sm:gap-[6px]" style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}>
            {Array.from({ length: 24 }).map((_, h) => {
              const show = h % 6 === 0;
              const showSm = h % 3 === 0;
              const isPeak = h === peakHour;
              return (
                <span
                  key={h}
                  className={`text-center text-[8.5px] sm:text-[9.5px] tabular-nums ${
                    show ? 'opacity-100' : showSm ? 'opacity-0 sm:opacity-100' : 'opacity-0'
                  } ${isPeak ? 'text-[var(--te-brand)] font-semibold' : 'text-[var(--te-text-quaternary)]'}`}
                >
                  {String(h).padStart(2, '0')}
                </span>
              );
            })}
          </div>
          <div className="text-[9px] sm:text-[10px] text-[var(--te-text-quaternary)] tracking-[0.5px] sm:tracking-[0.6px] uppercase text-right font-medium">
            total
          </div>
        </div>

        <div
          className="mt-3.5 sm:mt-[18px] py-3 sm:py-3.5 px-3 sm:px-4 rounded-[var(--te-r-md)] bg-[var(--bg-surface-elevated)] text-[12px] sm:text-[13.5px] text-[var(--te-text-primary)] leading-[1.5]"
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
