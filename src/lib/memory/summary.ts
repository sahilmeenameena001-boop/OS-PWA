import type { CalendarEvent, DailySummary, Habit, HabitLog, InboxItem, Note, Task, Transaction } from "@/lib/types";
import { isoInDay } from "@/lib/dates";
import { formatMoney } from "@/lib/format";

export interface MemoryItem {
  id: string;
  type: "note" | "capture" | "task" | "event" | "expense" | "document" | "habit";
  title: string;
  body: string | null;
  at: string; // ISO timestamp used for ordering
  dateKey: string;
  pinned: boolean;
  amount?: number;
  category?: string | null;
  linkedType: string;
  linkedId: string;
  resolved: boolean;
}

/** Deterministic summary of a day built purely from stored records. */
export function buildDailySummary(args: {
  dateKey: string;
  tasks: Task[];
  events: CalendarEvent[];
  transactions: Transaction[];
  inbox: InboxItem[];
  habits: Habit[];
  habitLogs: HabitLog[];
  currency: string;
}): DailySummary {
  const { dateKey } = args;
  const tasksDone = args.tasks.filter((t) => t.status === "done" && t.completed_at && isoInDay(t.completed_at, dateKey));
  const tasksOpen = args.tasks.filter((t) => t.status === "todo" && t.due_on === dateKey);
  const events = args.events.filter((e) => isoInDay(e.start_at, dateKey) && e.status !== "cancelled");
  const spent = args.transactions.filter((t) => t.status === "posted" && t.type === "expense" && t.occurred_on === dateKey).reduce((s, t) => s + t.amount, 0);
  const captures = args.inbox.filter((i) => isoInDay(i.captured_at, dateKey));
  const dow = new Date(dateKey + "T00:00:00").getDay();
  const planned = args.habits.filter((h) => h.is_active && h.schedule_days.includes(dow));
  const done = args.habitLogs.filter((l) => l.log_date === dateKey && l.status === "done");
  const highlights: string[] = [];
  if (tasksDone.length) highlights.push(`Completed ${tasksDone.length} task${tasksDone.length === 1 ? "" : "s"}: ${tasksDone.slice(0, 3).map((t) => t.title).join(", ")}`);
  if (events.length) highlights.push(`${events.length} event${events.length === 1 ? "" : "s"}: ${events.slice(0, 3).map((e) => e.title).join(", ")}`);
  if (spent > 0) highlights.push(`Spent ${formatMoney(spent, args.currency)}`);
  if (captures.length) highlights.push(`Captured ${captures.length} thought${captures.length === 1 ? "" : "s"}`);
  if (planned.length) highlights.push(`Habits ${done.length}/${planned.length}`);
  return {
    tasksDone: tasksDone.length,
    tasksOpen: tasksOpen.length,
    eventsCount: events.length,
    spent: Math.round(spent * 100) / 100,
    captures: captures.length,
    habitsDone: done.length,
    habitsPlanned: planned.length,
    highlights,
  };
}

export function summaryToText(s: DailySummary): string {
  if (!s.highlights.length) return "A quiet day. Nothing recorded.";
  return s.highlights.join(" · ");
}

export interface WeeklyReview {
  from: string;
  to: string;
  tasksDone: number;
  spent: number;
  captures: number;
  habitRate: number; // 0..1
  busiestDay: string | null;
  topCategories: { name: string; total: number }[];
}

export function buildWeeklyReview(args: {
  days: string[];
  tasks: Task[];
  transactions: Transaction[];
  inbox: InboxItem[];
  habits: Habit[];
  habitLogs: HabitLog[];
  categoryNames: Map<string, string>;
}): WeeklyReview {
  const from = args.days[0];
  const to = args.days[args.days.length - 1];
  const tasksDone = args.tasks.filter((t) => t.status === "done" && t.completed_at && t.completed_at.slice(0, 10) >= from && t.completed_at.slice(0, 10) <= to).length;
  const txs = args.transactions.filter((t) => t.status === "posted" && t.type === "expense" && t.occurred_on >= from && t.occurred_on <= to);
  const spent = txs.reduce((s, t) => s + t.amount, 0);
  const captures = args.inbox.filter((i) => i.captured_at.slice(0, 10) >= from && i.captured_at.slice(0, 10) <= to).length;
  let planned = 0;
  let done = 0;
  for (const d of args.days) {
    const dow = new Date(d + "T00:00:00").getDay();
    planned += args.habits.filter((h) => h.is_active && h.schedule_days.includes(dow)).length;
    done += args.habitLogs.filter((l) => l.log_date === d && l.status === "done").length;
  }
  const perDay = new Map<string, number>();
  for (const t of args.tasks) if (t.status === "done" && t.completed_at) perDay.set(t.completed_at.slice(0, 10), (perDay.get(t.completed_at.slice(0, 10)) ?? 0) + 1);
  const busiest = [...perDay.entries()].filter(([d]) => d >= from && d <= to).sort((a, b) => b[1] - a[1])[0];
  const byCat = new Map<string, number>();
  for (const t of txs) {
    const name = args.categoryNames.get(t.category_id ?? "") ?? "Uncategorised";
    byCat.set(name, (byCat.get(name) ?? 0) + t.amount);
  }
  return {
    from,
    to,
    tasksDone,
    spent: Math.round(spent * 100) / 100,
    captures,
    habitRate: planned ? done / planned : 0,
    busiestDay: busiest ? busiest[0] : null,
    topCategories: [...byCat.entries()]
      .map(([name, total]) => ({ name, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5),
  };
}

export function buildMemoryItems(args: {
  notes: Note[];
  inbox: InboxItem[];
  tasks: Task[];
  events: CalendarEvent[];
  transactions: Transaction[];
  attachments: { id: string; title: string | null; file_name: string; created_at: string; kind: string }[];
  categoryNames: Map<string, string>;
}): MemoryItem[] {
  const items: MemoryItem[] = [];
  for (const n of args.notes)
    items.push({ id: `note:${n.id}`, type: "note", title: n.title || n.body.slice(0, 60) || "Note", body: n.body, at: n.created_at, dateKey: n.created_at.slice(0, 10), pinned: n.pinned, linkedType: "notes", linkedId: n.id, resolved: true, category: n.kind });
  for (const i of args.inbox)
    if (i.status !== "deleted")
      items.push({ id: `capture:${i.id}`, type: "capture", title: i.content.split("\n")[0] || i.url || "Capture", body: i.url ?? null, at: i.captured_at, dateKey: i.captured_at.slice(0, 10), pinned: false, linkedType: "inbox_items", linkedId: i.id, resolved: i.status !== "unprocessed", category: i.kind });
  for (const t of args.tasks)
    if (t.status === "done" && t.completed_at)
      items.push({ id: `task:${t.id}`, type: "task", title: t.title, body: t.description, at: t.completed_at, dateKey: t.completed_at.slice(0, 10), pinned: false, linkedType: "tasks", linkedId: t.id, resolved: true, category: t.category });
  for (const e of args.events)
    if (e.status !== "cancelled")
      items.push({ id: `event:${e.id}`, type: "event", title: e.title, body: e.location, at: e.start_at, dateKey: e.start_at.slice(0, 10), pinned: false, linkedType: "events", linkedId: e.id, resolved: true, category: e.category });
  for (const t of args.transactions)
    if (t.status === "posted" && t.type === "expense")
      items.push({ id: `expense:${t.id}`, type: "expense", title: t.merchant ?? args.categoryNames.get(t.category_id ?? "") ?? "Expense", body: t.note, at: t.occurred_at, dateKey: t.occurred_on, pinned: false, amount: t.amount, category: args.categoryNames.get(t.category_id ?? "") ?? null, linkedType: "transactions", linkedId: t.id, resolved: true });
  for (const a of args.attachments)
    items.push({ id: `document:${a.id}`, type: "document", title: a.title ?? a.file_name, body: null, at: a.created_at, dateKey: a.created_at.slice(0, 10), pinned: false, linkedType: "attachments", linkedId: a.id, resolved: true, category: a.kind });
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

/** Simple tokenised full-text match; every query token must appear somewhere in the item. */
export function matchesQuery(item: MemoryItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = `${item.title} ${item.body ?? ""} ${item.category ?? ""} ${item.type}`.toLowerCase();
  return q.split(/\s+/).every((tok) => hay.includes(tok));
}
