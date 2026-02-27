import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Calendar, CalendarDays, CalendarRange, CalendarClock } from 'lucide-react';

export type Period = 'today' | 'week' | 'month' | 'year';

const PERIOD_OPTIONS: { value: Period; label: string; icon: typeof Calendar }[] = [
  { value: 'today', label: 'Hoy', icon: Calendar },
  { value: 'week', label: 'Semana', icon: CalendarDays },
  { value: 'month', label: 'Mes', icon: CalendarRange },
  { value: 'year', label: 'Año', icon: CalendarClock },
];

interface PeriodFilterProps {
  value: Period;
  onChange: (period: Period) => void;
  className?: string;
}

export const PeriodFilter = ({ value, onChange, className }: PeriodFilterProps) => (
  <ToggleGroup
    type="single"
    value={value}
    onValueChange={(v) => v && onChange(v as Period)}
    className={`border border-border bg-card ${className || ''}`}
  >
    {PERIOD_OPTIONS.map((opt) => (
      <ToggleGroupItem
        key={opt.value}
        value={opt.value}
        className="gap-1 text-xs px-2.5 flex-1 sm:flex-none sm:px-3"
      >
        <opt.icon className="h-3.5 w-3.5" />
        {opt.label}
      </ToggleGroupItem>
    ))}
  </ToggleGroup>
);
