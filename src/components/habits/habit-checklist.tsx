"use client";
import Link from "next/link";
import { toast } from "sonner";
import { useSession } from "@/lib/session/session-provider";
import { getDB } from "@/lib/data/db";
import { insert, update, remove } from "@/lib/data/repo";
import type { Habit, HabitLog, HabitLogStatus } from "@/lib/types";
import { IconCheck, IconDrop, IconHeart, IconPill, IconRun, IconSleep, IconSkip } from "@/components/icons";
import { cn } from "@/lib/utils";
import { useUI } from "@/store/ui";

export function habitIcon(kind: Habit["kind"], size = 18) {
  switch (kind) {
    case "medicine": return <IconPill size={size} />;
    case "water": return <IconDrop size={size} />;
    case "exercise": return <IconRun size={size} />;
    case "sleep": return <IconSleep size={size} />;
    case "rehab": return <IconHeart size={size} />;
    default: return <IconCheck size={size} />;
  }
}

export async function logHabit(userId: string, habit: Habit, dateKey: string, status: HabitLogStatus | null, value?: number | null): Promise<void> {
  const existing = await getDB().habit_logs.where("[habit_id+log_date]").equals([habit.id, dateKey]).first();
  if (!status) {
    if (existing) await remove("habit_logs", userId, existing.id);
    return;
  }
  if (existing) await update("habit_logs", userId, existing.id, { status, value: value ?? existing.value, logged_at: new Date().toISOString() });
  else await insert("habit_logs", userId, { habit_id: habit.id, log_date: dateKey, status, value: value ?? null, note: null, logged_at: new Date().toISOString() });
}

export function HabitChecklist({ habits, logs, dateKey, essentialOnly }: { habits: Habit[]; logs: HabitLog[]; dateKey: string; essentialOnly?: boolean }) {
  const { userId } = useSession();
  const announce = useUI((s) => s.announce);
  const dow = new Date(dateKey + "T00:00:00").getDay();
  const list = habits.filter((h) => h.is_active && h.schedule_days.includes(dow) && (!essentialOnly || h.is_essential));
  const logFor = (id: string) => logs.find((l) => l.habit_id === id && l.log_date === dateKey);
  if (list.length === 0) return <p className="text-sm text-muted-foreground">{habits.filter((h) => h.is_active).length === 0 ? <>No habits yet. <Link href="/habits" className="text-primary underline-offset-2 hover:underline">Add a medicine, walk or water reminder</Link>.</> : essentialOnly ? <>No essential habits today. <Link href="/habits" className="text-primary underline-offset-2 hover:underline">Mark one as essential</Link> to see it here.</> : "No habits scheduled for this day."}</p>;
  return (
    <ul className="space-y-1">
      {list.map((h) => {
        const log = logFor(h.id);
        const done = log?.status === "done";
        const countable = h.target_per_day > 1;
        const value = log?.value ?? 0;
        const toggle = async () => {
          if (countable) {
            const next = Math.min(h.target_per_day, value + 1);
            await logHabit(userId, h, dateKey, next >= h.target_per_day ? "done" : "skipped", next);
            if (next >= h.target_per_day) announce(`${h.name} complete`);
            return;
          }
          await logHabit(userId, h, dateKey, done ? null : "done");
          announce(done ? `${h.name} unmarked` : `${h.name} done`);
        };
        return (
          <li key={h.id} className={cn("flex items-center gap-2 rounded-xl px-2 py-1.5", done && "opacity-70")}>
            <button onClick={toggle} aria-pressed={done} aria-label={`${h.name}${countable ? `, ${value} of ${h.target_per_day} ${h.unit ?? ""}` : ""}`} className="tap grid shrink-0 place-items-center">
              <span className={cn("grid size-9 place-items-center rounded-full border-2 transition-colors", done ? "border-mint bg-mint text-mint-foreground" : "border-border text-muted-foreground hover:border-primary")}>{done ? <IconCheck size={16} /> : habitIcon(h.kind, 16)}</span>
            </button>
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-sm font-medium", done && "line-through")}>{h.name}</p>
              <p className="text-xs text-muted-foreground">
                {h.times[0] ? `${h.times[0]} · ` : ""}
                {countable ? `${value}/${h.target_per_day} ${h.unit ?? ""}` : log?.status === "skipped" ? "Skipped" : log?.status === "missed" ? "Missed" : h.is_essential ? "Essential" : h.kind}
              </p>
            </div>
            {countable && !done ? (
              <div className="flex gap-1" aria-hidden="true">
                {Array.from({ length: h.target_per_day }).map((_, i) => <span key={i} className={cn("h-2 w-1.5 rounded-sm", i < value ? "bg-primary" : "bg-muted")} />)}
              </div>
            ) : null}
            {!done && !countable ? (
              <button onClick={() => { void logHabit(userId, h, dateKey, log?.status === "skipped" ? null : "skipped"); toast(log?.status === "skipped" ? "Skip cleared" : "Skipped for today"); }} aria-pressed={log?.status === "skipped"} aria-label={`Skip ${h.name} today`} className="tap grid place-items-center rounded-lg text-muted-foreground hover:bg-muted"><IconSkip size={16} /></button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
