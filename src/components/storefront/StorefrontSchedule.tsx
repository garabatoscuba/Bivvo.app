import { Clock } from 'lucide-react';

const DAY_LABELS: Record<string, string> = {
  monday: 'Lun', tuesday: 'Mar', wednesday: 'Mié',
  thursday: 'Jue', friday: 'Vie', saturday: 'Sáb', sunday: 'Dom',
};

const DAYS_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const DAY_MAP: Record<number, string> = {
  1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday',
  5: 'friday', 6: 'saturday', 0: 'sunday',
};

interface DayInfo { open: string | null; close: string | null; enabled: boolean }

interface Props {
  schedule: Record<string, DayInfo>;
}

const StorefrontSchedule = ({ schedule }: Props) => {
  const todayKey = DAY_MAP[new Date().getDay()];

  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" /> Horario
      </h3>
      <div className="space-y-1">
        {DAYS_ORDER.map(day => {
          const d = schedule[day];
          const isToday = todayKey === day;
          return (
            <div
              key={day}
              className={`flex justify-between text-sm py-1.5 px-2.5 rounded-lg ${isToday ? 'bg-card font-medium' : ''}`}
            >
              <span className={d?.enabled ? 'text-foreground/70' : 'text-muted-foreground/40'}>
                {DAY_LABELS[day]}
              </span>
              <span className={d?.enabled ? 'text-foreground tabular-nums' : 'text-muted-foreground/40'}>
                {d?.enabled ? `${d.open} – ${d.close}` : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StorefrontSchedule;
