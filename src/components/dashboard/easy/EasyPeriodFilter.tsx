import { Calendar, CalendarDays, CalendarRange, CalendarClock } from 'lucide-react';
import type { Period } from '@/components/ui/period-filter';

const OPTIONS: { value: Period; label: string; Icon: typeof Calendar }[] = [
  { value: 'today', label: 'Hoy', Icon: Calendar },
  { value: 'week', label: 'Semana', Icon: CalendarDays },
  { value: 'month', label: 'Mes', Icon: CalendarRange },
  { value: 'year', label: 'Año', Icon: CalendarClock },
];

interface Props {
  value: Period;
  onChange: (p: Period) => void;
}

const EasyPeriodFilter = ({ value, onChange }: Props) => (
  <div className="flex w-full sm:inline-flex sm:w-auto bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--te-r-md)] p-[3px] gap-0.5">
    {OPTIONS.map(({ value: v, label, Icon }) => {
      const active = v === value;
      return (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-[7px] rounded-[7px] text-[12.5px] font-medium border-0 cursor-pointer transition-colors ${
            active
              ? 'bg-[var(--te-brand-soft)] text-[var(--te-brand)]'
              : 'bg-transparent text-[var(--te-text-tertiary)] hover:text-[var(--te-text-primary)]'
          }`}
        >
          <Icon className="w-3 h-3" strokeWidth={2} />
          {label}
        </button>
      );
    })}
  </div>
);

export default EasyPeriodFilter;
