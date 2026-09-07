import { getDB } from "@/lib/data/db";
import { insert, update } from "@/lib/data/repo";
import { occursOn } from "@/lib/schedule/recurrence";
import { todayKey } from "@/lib/dates";
import type { AppNotification, CalendarEvent, NotificationLevel, NotificationPreferences, Reminder, Task } from "@/lib/types";

export interface DueItem {
  key: string;
  title: string;
  body: string | null;
  level: NotificationLevel;
  linkedType: string;
  linkedId: string;
  fireAt: string;
}

/** Compute everything that should fire between `since` and `now`. Pure. */
export function computeDue(args: { now: Date; since: Date; reminders: Reminder[]; events: CalendarEvent[]; tasks: Task[] }): DueItem[] {
  const out: DueItem[] = [];
  const inWindow = (iso: string) => {
    const t = new Date(iso).getTime();
    return t > args.since.getTime() && t <= args.now.getTime();
  };
  for (const r of args.reminders) {
    if (r.status === "acknowledged" || r.status === "dismissed") continue;
    const at = r.status === "snoozed" && r.snoozed_until ? r.snoozed_until : r.remind_at;
    if (inWindow(at)) out.push({ key: `reminder:${r.id}:${at}`, title: r.title, body: r.body, level: r.level, linkedType: "reminders", linkedId: r.id, fireAt: at });
  }
  const today = todayKey(args.now);
  for (const e of args.events) {
    if (e.status !== "scheduled") continue;
    const anchorKey = e.start_at.slice(0, 10);
    const startToday = new Date(e.start_at);
    const occursToday = e.recurrence ? occursOn(e.recurrence, anchorKey, today) : anchorKey === today;
    if (!occursToday) continue;
    if (e.recurrence) {
      const d = new Date(today + "T00:00:00");
      startToday.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    }
    for (const off of e.reminder_offsets.length ? e.reminder_offsets : [0]) {
      const at = new Date(startToday.getTime() - off * 60_000).toISOString();
      if (inWindow(at)) out.push({ key: `event:${e.id}:${at}`, title: e.title, body: off ? `Starts in ${off} min` : "Starting now", level: off === 0 ? "important" : "gentle", linkedType: "events", linkedId: e.id, fireAt: at });
    }
  }
  for (const t of args.tasks) {
    if (t.status !== "todo" || !t.scheduled_start) continue;
    for (const off of t.reminder_offsets.length ? t.reminder_offsets : [0]) {
      const at = new Date(new Date(t.scheduled_start).getTime() - off * 60_000).toISOString();
      if (inWindow(at)) out.push({ key: `task:${t.id}:${at}`, title: t.title, body: off ? `Due in ${off} min` : "Time to start", level: t.priority === 1 ? "important" : "gentle", linkedType: "tasks", linkedId: t.id, fireAt: at });
    }
  }
  return out.sort((a, b) => a.fireAt.localeCompare(b.fireAt));
}

function inQuietHours(prefs: NotificationPreferences | null, now: Date): boolean {
  if (!prefs?.quiet_hours_start || !prefs.quiet_hours_end) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = prefs.quiet_hours_start.split(":").map(Number);
  const [eh, em] = prefs.quiet_hours_end.split(":").map(Number);
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  return s <= e ? cur >= s && cur < e : cur >= s || cur < e;
}

function levelEnabled(prefs: NotificationPreferences | null, level: NotificationLevel): boolean {
  if (!prefs) return true;
  if (level === "gentle") return prefs.gentle_enabled;
  if (level === "important") return prefs.important_enabled;
  return prefs.persistent_enabled;
}

/** Runs on an interval in the shell. Materialises due items into the in-app centre and (optionally) the browser. */
export async function runNotificationTick(userId: string): Promise<AppNotification[]> {
  const db = getDB();
  const now = new Date();
  const cursorRow = await db.kv.get(`notify:cursor:${userId}`);
  const since = typeof cursorRow?.value === "string" ? new Date(cursorRow.value) : new Date(now.getTime() - 5 * 60_000);
  const [reminders, events, tasks, prefs] = await Promise.all([
    db.reminders.where("user_id").equals(userId).toArray(),
    db.events.where("user_id").equals(userId).toArray(),
    db.tasks.where("user_id").equals(userId).toArray(),
    db.notification_preferences.where("user_id").equals(userId).first(),
  ]);
  const due = computeDue({ now, since, reminders, events, tasks });
  const firedRow = await db.kv.get(`notify:fired:${userId}`);
  const fired = new Set<string>(Array.isArray(firedRow?.value) ? (firedRow.value as string[]) : []);
  const created: AppNotification[] = [];
  const quiet = inQuietHours(prefs ?? null, now);
  for (const d of due) {
    if (fired.has(d.key)) continue;
    fired.add(d.key);
    if (!levelEnabled(prefs ?? null, d.level)) continue;
    if (quiet && d.level !== "persistent") continue;
    const n = await insert("notifications", userId, { title: d.title, body: d.body, level: d.level, status: "unread", fire_at: d.fireAt, linked_type: d.linkedType, linked_id: d.linkedId });
    created.push(n);
    if (d.linkedType === "reminders") await update("reminders", userId, d.linkedId, { status: "sent" });
    if (prefs?.browser_enabled) showBrowserNotification(n);
  }
  await db.kv.put({ key: `notify:cursor:${userId}`, value: now.toISOString() });
  await db.kv.put({ key: `notify:fired:${userId}`, value: [...fired].slice(-500) });
  return created;
}

export function showBrowserNotification(n: AppNotification): void {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const notif = new Notification(n.title, { body: n.body ?? undefined, tag: n.id, requireInteraction: n.level === "persistent", silent: n.level === "gentle" });
    notif.onclick = () => window.focus();
  } catch {
    // Some mobile browsers only allow notifications via the service worker; the in-app centre still has it.
  }
}

export async function requestBrowserPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}
