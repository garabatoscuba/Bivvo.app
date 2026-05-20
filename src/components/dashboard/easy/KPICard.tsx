import type { ReactNode } from 'react';
import { ChevronUp, ChevronDown, Clock } from 'lucide-react';

interface Props {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  delta?: { value: string; direction: 'up' | 'down' | 'neutral' };
  sparklineData: number[]; // values to plot
  sparklineColor?: string; // brand/red/neutral
  sparklineFillId: string; // unique gradient id
}

const buildPath = (data: number[], w = 400, h = 56) => {
  if (data.length < 2) return { line: '', area: '' };
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const points = data.map((v, i) => {
    const x = i * step;
    const y = h - 6 - ((v - min) / range) * (h - 14);
    return [x, y] as [number, number];
  });
  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  return { line, area };
};

const KPICard = ({ label, value, unit, hint, delta, sparklineData, sparklineColor = '#10D9A0', sparklineFillId }: Props) => {
  const { line, area } = buildPath(sparklineData);

  const deltaCls =
    delta?.direction === 'up'
      ? 'bg-[var(--te-brand-soft)] text-[var(--te-brand)]'
      : delta?.direction === 'down'
        ? 'bg-[var(--te-red-soft)] text-[var(--te-red)]'
        : 'bg-white/[0.04] text-[var(--te-text-tertiary)]';

  const deltaHalo =
    delta?.direction === 'up'
      ? 'rgba(16, 217, 160, 0.18)'
      : delta?.direction === 'down'
        ? 'rgba(239, 68, 68, 0.18)'
        : 'rgba(255, 255, 255, 0.06)';

  const DeltaIcon = delta?.direction === 'up'
    ? ChevronUp
    : delta?.direction === 'down'
      ? ChevronDown
      : Clock;

  return (
    <div className="relative overflow-hidden flex flex-col rounded-[var(--te-r-lg)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] min-h-[120px] sm:min-h-[140px]">
      <div className="relative z-[2] px-4 sm:px-5 pt-3.5 sm:pt-[18px]">
        <div className="flex items-center justify-between text-[11.5px] sm:text-[12.5px] font-medium text-[var(--te-text-tertiary)]">
          {label}
          {delta && (
            <span
              className={`relative z-[3] inline-flex items-center gap-1 text-[10.5px] sm:text-[11.5px] font-semibold px-1.5 py-0.5 rounded-full ${deltaCls}`}
              style={{ boxShadow: `0 0 0 3px ${deltaHalo}` }}
            >
              <DeltaIcon className="w-2.5 h-2.5" strokeWidth={3} />
              {delta.value}
            </span>
          )}
        </div>
        <div className="text-[26px] sm:text-[34px] font-semibold tracking-[-0.6px] sm:tracking-[-0.8px] mt-1.5 sm:mt-2.5 leading-[1.1] text-[var(--te-text-primary)]">
          {value}
          {unit && <span className="text-[13px] sm:text-[16px] text-[var(--te-text-tertiary)] font-medium ml-0.5">{unit}</span>}
        </div>
        {hint && <div className="text-[11px] sm:text-[12px] text-[var(--te-text-tertiary)] mt-1">{hint}</div>}
      </div>

      <svg
        className="absolute left-0 right-0 bottom-0 w-full h-[56px] pointer-events-none block"
        viewBox="0 0 400 56"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={sparklineFillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={sparklineColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={sparklineColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {area && <path d={area} fill={`url(#${sparklineFillId})`} />}
        {line && (
          <path
            d={line}
            fill="none"
            stroke={sparklineColor}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </div>
  );
};

export default KPICard;
