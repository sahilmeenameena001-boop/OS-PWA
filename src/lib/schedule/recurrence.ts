import { addDays, differenceInCalendarDays } from "date-fns";
import type { Recurrence } from "@/lib/types";
import { fromDateKey, toDateKey } from "@/lib/dates";

export const WEEKDAYS = [1, 2, 3, 4, 5];

/** Does a recurrence starting on `anchorKey` produce an occurrence on `dateKey`? */
export function occursOn(rec: Recurrence | null, anchorKey: string, dateKey: string): boolean {
  if (!rec) return anchorKey === dateKey;
  if (dateKey < anchorKey) return false;
  if (rec.until && dateKey > rec.until) return false;
  const anchor = fromDateKey(anchorKey);
  const date = fromDateKey(dateKey);
  const interval = Math.max(1, rec.interval ?? 1);
  const diffDays = differenceInCalendarDays(date, anchor);
  switch (rec.frequency) {
    case "daily":
      return diffDays % interval === 0;
    case "weekdays":
      return WEEKDAYS.includes(date.getDay());
    case "weekly": {
      const days = rec.days && rec.days.length ? rec.days : [anchor.getDay()];
      if (!days.includes(date.getDay())) return false;
      const weeks = Math.floor(diffDays / 7);
      return weeks % interval === 0;
    }
    case "custom": {
      const days = rec.days ?? [];
      return days.includes(date.getDay());
    }
    default:
      return false;
  }
}

/** All occurrence date keys within [fromKey, toKey] inclusive. Bounded to 400 days. */
export function occurrencesBetween(rec: Recurrence | null, anchorKey: string, fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  const start = fromDateKey(fromKey < anchorKey ? anchorKey : fromKey);
  const end = fromDateKey(toKey);
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < 400) {
    const key = toDateKey(cursor);
    if (occursOn(rec, anchorKey, key)) out.push(key);
    cursor = addDays(cursor, 1);
    guard++;
  }
  return out;
}

export function nextOccurrence(rec: Recurrence | null, anchorKey: string, afterKey: string): string | null {
  const from = addDays(fromDateKey(afterKey), 1);
  const occ = occurrencesBetween(rec, anchorKey, toDateKey(from), toDateKey(addDays(from, 400)));
  return occ[0] ?? null;
}

export function describeRecurrence(rec: Recurrence | null): string {
  if (!rec) return "Once";
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  switch (rec.frequency) {
    case "daily":
      return rec.interval && rec.interval > 1 ? `Every ${rec.interval} days` : "Daily";
    case "weekdays":
      return "Weekdays";
    case "weekly":
      return `Weekly on ${(rec.days ?? []).map((d) => names[d]).join(", ") || "same day"}`;
    case "custom":
      return (rec.days ?? []).map((d) => names[d]).join(", ") || "Custom";
  }
}

/** Advance a bill/subscription due date by one cycle, keeping the day-of-month where possible. */
export function advanceDue(dateKey: string, cycle: "monthly" | "weekly" | "yearly" | "once"): string {
  const d = fromDateKey(dateKey);
  if (cycle === "once") return dateKey;
  if (cycle === "weekly") return toDateKey(addDays(d, 7));
  const target = new Date(d);
  if (cycle === "monthly") target.setMonth(target.getMonth() + 1);
  else target.setFullYear(target.getFullYear() + 1);
  // JS overflows 31 Jan + 1 month to 3 Mar; clamp to the last day of the intended month.
  if (target.getDate() !== d.getDate()) target.setDate(0);
  return toDateKey(target);
}
