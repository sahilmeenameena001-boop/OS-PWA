import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfDay,
  format,
  isSameDay,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns";

/** Local calendar date as YYYY-MM-DD (never UTC-shifted). */
export function toDateKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function todayKey(now: Date = new Date()): string {
  return toDateKey(now);
}

/** Parse a YYYY-MM-DD key as local midnight. */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function dayBounds(dateKey: string): { start: Date; end: Date } {
  const d = fromDateKey(dateKey);
  return { start: startOfDay(d), end: endOfDay(d) };
}

export function isoInDay(iso: string, dateKey: string): boolean {
  return isSameDay(parseISO(iso), fromDateKey(dateKey));
}

export function weekDays(anchor: Date, weekStartsOn: 0 | 1 = 1): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function formatTime(iso: string): string {
  return format(parseISO(iso), "h:mm a");
}

export function formatDateHuman(key: string, now: Date = new Date()): string {
  const d = fromDateKey(key);
  const diff = differenceInCalendarDays(d, now);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return format(d, "EEE, d MMM");
}

/**
 * Budget period anchored on the income day. Returns [start, end] date keys and the
 * number of days remaining including today.
 */
export function budgetPeriod(incomeDay: number, now: Date = new Date()): {
  start: string;
  end: string;
  remainingDays: number;
  totalDays: number;
} {
  const day = Math.min(Math.max(incomeDay, 1), 28);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), day);
  const start = now.getDate() >= day ? thisMonthStart : addMonths(thisMonthStart, -1);
  const end = addDays(addMonths(start, 1), -1);
  const remainingDays = Math.max(differenceInCalendarDays(end, now) + 1, 1);
  const totalDays = differenceInCalendarDays(end, start) + 1;
  return { start: toDateKey(start), end: toDateKey(end), remainingDays, totalDays };
}

export function monthKey(d: Date = new Date()): string {
  return format(d, "yyyy-MM-01");
}

export function greetingFor(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

export function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function combineDateTime(dateKey: string, time: string): Date {
  const d = fromDateKey(dateKey);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}
