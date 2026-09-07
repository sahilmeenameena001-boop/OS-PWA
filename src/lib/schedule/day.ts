import { addDays } from "date-fns";
import type { CalendarEvent, Routine, Task } from "@/lib/types";
import { fromDateKey, toDateKey, combineDateTime } from "@/lib/dates";
import { occursOn } from "@/lib/schedule/recurrence";
import { update } from "@/lib/data/repo";

export interface DayItem {
  key: string;
  kind: "task" | "event" | "routine";
  id: string;
  title: string;
  start: Date | null;
  end: Date | null;
  allDay: boolean;
  status: string;
  priority: number;
  category: string | null;
  color: "primary" | "mint" | "amber" | "coral" | "violet";
  source: Task | CalendarEvent | Routine;
}

function shiftToDay(iso: string, dateKey: string): Date {
  const d = new Date(iso);
  const target = fromDateKey(dateKey);
  d.setFullYear(target.getFullYear(), target.getMonth(), target.getDate());
  return d;
}

/** Expand tasks, events and routines into concrete items for one calendar day. */
export function itemsForDay(dateKey: string, tasks: Task[], events: CalendarEvent[], routines: Routine[] = []): DayItem[] {
  const out: DayItem[] = [];
  const dow = fromDateKey(dateKey).getDay();
  for (const t of tasks) {
    const anchor = t.due_on ?? (t.scheduled_start ? t.scheduled_start.slice(0, 10) : null);
    if (!anchor) continue;
    const onDay = t.recurrence ? occursOn(t.recurrence, anchor, dateKey) : anchor === dateKey;
    if (!onDay) continue;
    if (t.recurrence && t.status === "done" && t.completed_at && t.completed_at.slice(0, 10) !== dateKey) continue;
    const start = t.scheduled_start ? shiftToDay(t.scheduled_start, dateKey) : null;
    const end = t.scheduled_end ? shiftToDay(t.scheduled_end, dateKey) : start ? new Date(start.getTime() + 30 * 60_000) : null;
    out.push({ key: `task:${t.id}:${dateKey}`, kind: "task", id: t.id, title: t.title, start, end, allDay: !start, status: t.status, priority: t.priority, category: t.category, color: t.priority === 1 ? "coral" : t.priority === 2 ? "amber" : "primary", source: t });
  }
  for (const e of events) {
    if (e.status === "cancelled") continue;
    const anchor = e.start_at.slice(0, 10);
    const onDay = e.recurrence ? occursOn(e.recurrence, anchor, dateKey) : anchor === dateKey;
    if (!onDay) continue;
    const start = shiftToDay(e.start_at, dateKey);
    const end = new Date(start.getTime() + (new Date(e.end_at).getTime() - new Date(e.start_at).getTime()));
    out.push({ key: `event:${e.id}:${dateKey}`, kind: "event", id: e.id, title: e.title, start: e.all_day ? null : start, end: e.all_day ? null : end, allDay: e.all_day, status: e.status, priority: 3, category: e.category, color: "violet", source: e });
  }
  for (const r of routines) {
    if (!r.is_active || !r.days.includes(dow) || !r.start_time) continue;
    const start = combineDateTime(dateKey, r.start_time);
    out.push({ key: `routine:${r.id}:${dateKey}`, kind: "routine", id: r.id, title: r.name, start, end: new Date(start.getTime() + r.duration_min * 60_000), allDay: false, status: "scheduled", priority: 4, category: r.kind, color: "mint", source: r });
  }
  return out.sort((a, b) => {
    if (a.start && b.start) return a.start.getTime() - b.start.getTime();
    if (a.start) return 1;
    if (b.start) return -1;
    return a.priority - b.priority;
  });
}

export function overdueTasks(tasks: Task[], todayKey: string): Task[] {
  return tasks.filter((t) => t.status === "todo" && !t.recurrence && t.due_on && t.due_on < todayKey).sort((a, b) => (a.due_on ?? "").localeCompare(b.due_on ?? ""));
}

/** Move a task to a new day, preserving its time of day if it had one. */
export async function rescheduleTask(userId: string, task: Task, toDateKey: string): Promise<void> {
  let scheduled_start = task.scheduled_start;
  let scheduled_end = task.scheduled_end;
  if (scheduled_start) {
    const s = shiftToDay(scheduled_start, toDateKey);
    scheduled_start = s.toISOString();
    if (scheduled_end) {
      const dur = new Date(task.scheduled_end!).getTime() - new Date(task.scheduled_start!).getTime();
      scheduled_end = new Date(s.getTime() + dur).toISOString();
    }
  }
  await update("tasks", userId, task.id, { due_on: toDateKey, scheduled_start, scheduled_end, status: "todo" });
}

export async function rescheduleAllOverdue(userId: string, tasks: Task[], toKey: string): Promise<number> {
  let n = 0;
  for (const t of tasks) {
    await rescheduleTask(userId, t, toKey);
    n++;
  }
  return n;
}

export function tomorrowKey(fromKey: string): string {
  return toDateKey(addDays(fromDateKey(fromKey), 1));
}

export async function setTaskStatus(userId: string, task: Task, status: Task["status"], todayKeyStr: string): Promise<void> {
  if (status === "postponed") {
    await rescheduleTask(userId, task, tomorrowKey(todayKeyStr));
    return;
  }
  if (task.recurrence && status === "done") {
    // Recurring tasks: mark done today; it reappears on the next occurrence.
    await update("tasks", userId, task.id, { status: "done", completed_at: new Date().toISOString() });
    return;
  }
  await update("tasks", userId, task.id, { status, completed_at: status === "done" ? new Date().toISOString() : null });
}

/** Recurring tasks completed on an earlier day become open again automatically. */
export function effectiveTaskStatus(task: Task, dateKey: string): Task["status"] {
  if (task.recurrence && task.status === "done" && task.completed_at && task.completed_at.slice(0, 10) !== dateKey) return "todo";
  return task.status;
}
