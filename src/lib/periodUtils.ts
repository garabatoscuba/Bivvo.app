import {
  startOfDay, endOfDay, subDays, startOfMonth, endOfMonth,
  subMonths, startOfYear, endOfYear, subYears,
} from 'date-fns';

export type Period = 'today' | 'week' | 'month' | 'year';

export interface DateRange {
  start: Date;
  end: Date;
}

export function getDateRange(period: Period): DateRange {
  const now = new Date();
  switch (period) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'week':
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'year':
      return { start: startOfYear(now), end: endOfYear(now) };
  }
}

export function isInPeriod(dateStr: string, period: Period): boolean {
  if (!dateStr) return false;
  const ts = new Date(dateStr).getTime();
  if (isNaN(ts)) return false;
  const range = getDateRange(period);
  return ts >= range.start.getTime() && ts <= range.end.getTime();
}
