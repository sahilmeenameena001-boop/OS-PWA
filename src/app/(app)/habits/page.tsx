"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { addDays, format, subDays } from "date-fns";
import { useSession } from "@/lib/session/session-provider";
import { useRows, useRowsOr } from "@/lib/data/hooks";
import { insert, update, remove } from "@/lib/data/repo";
import { todayKey, toDateKey } from "@/lib/dates";
import { PageHeader, Panel, EmptyState, Field, ConfirmDialog, SkeletonRows } from "@/components/common";
import { HabitChecklist, habitIcon, logHabit } from "@/components/habits/habit-checklist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IconPlus, IconEdit, IconInfo } from "@/components/icons";
import type { Habit, HabitLog } from "@/lib/types";
import { cn } from "@/lib/utils";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Current run of consecutive scheduled days marked done, ending today or yesterday. Never punitive. */
function streak(habit: Habit, logs: HabitLog[], today: string): number {
  const done = new Set(logs.filter((l) => l.habit_id === habit.id && l.status === "done").map((l) => l.log_date));
  let n = 0;
  let d = new Date(today + "T00:00:00");
  let first = true;
  for (let i = 0; i < 365; i++) {
    const key = toDateKey(d);
    if (habit.schedule_days.includes(d.getDay())) {
      if (done.has(key)) n++;
      else if (!first) break;
      else if (!done.has(key) && i > 0) break;
      first = false;
    }
    d = subDays(d, 1);
  }
  return n;
}

export default function HabitsPage() {
  const { userId } = useSession();
  const habits = useRows("habits");
  const logs = useRowsOr("habit_logs");
  const today = todayKey();
  const [dlg, setDlg] = useState<{ habit: Habit | null } | null>(null);
  const [del, setDel] = useState<Habit | null>(null);
  const [selectedDate, setSelectedDate] = useState(today);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => toDateKey(addDays(subDays(new Date(), 6), i))), []);

  const weekly = useMemo(() => {
    return week.map((d) => {
      const dow = new Date(d + "T00:00:00").getDay();
      const planned = (habits ?? []).filter((h) => h.is_active && h.schedule_days.includes(dow)).length;
      const done = logs.filter((l) => l.log_date === d && l.status === "done").length;
      return { d, planned, done, rate: planned ? done / planned : 0 };
    });
  }, [week, habits, logs]);

  return (
    <div className="space-y-4">
      <PageHeader title="Habits & health" subtitle="Medicines, movement, water, sleep, rehab. Check in without pressure." actions={<Button size="sm" onClick={() => setDlg({ habit: null })}><IconPlus size={16} /> Habit</Button>} />
      <p className="flex items-start gap-2 rounded-xl border border-amber/40 bg-amber/10 px-3 py-2 text-xs text-foreground"><IconInfo size={16} className="mt-0.5 shrink-0 text-amber" /><span>This app tracks routines you set for yourself. It is not medical advice, does not diagnose, and never changes medication. Follow your clinician&apos;s instructions.</span></p>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Check-ins" action={<Input type="date" aria-label="Check-in date" value={selectedDate} max={today} onChange={(e) => setSelectedDate(e.target.value)} className="h-9 w-40" />}>
          {!habits ? <SkeletonRows /> : habits.filter((h) => h.is_active).length === 0 ? <EmptyState title="No habits yet" body="Start with one that matters, like a medicine or a walk." action={<Button onClick={() => setDlg({ habit: null })}>Add habit</Button>} /> : <HabitChecklist habits={habits} logs={logs} dateKey={selectedDate} />}
        </Panel>
        <Panel title="This week">
          <svg viewBox="0 0 360 140" className="h-40 w-full" role="img" aria-label={`Weekly completion: ${weekly.map((w) => `${format(new Date(w.d + "T00:00:00"), "EEE")} ${w.done} of ${w.planned}`).join(", ")}`}>
            {weekly.map((w, i) => {
              const x = 20 + i * 48;
              const h = Math.max(4, w.rate * 90);
              return (
                <g key={w.d}>
                  <rect x={x} y={110 - 90} width="28" height="90" rx="6" fill="var(--muted)" />
                  <rect x={x} y={110 - h} width="28" height={h} rx="6" fill={w.rate >= 0.8 ? "var(--mint)" : w.rate >= 0.5 ? "var(--primary)" : "var(--amber)"} style={{ transition: "height 500ms, y 500ms" }} />
                  <text x={x + 14} y="128" textAnchor="middle" fontSize="11" fill="currentColor" fillOpacity="0.7">{format(new Date(w.d + "T00:00:00"), "EEE")}</text>
                  <text x={x + 14} y={110 - h - 4} textAnchor="middle" fontSize="10" fill="currentColor" fillOpacity="0.8">{w.planned ? `${w.done}/${w.planned}` : ""}</text>
                </g>
              );
            })}
          </svg>
          <table className="sr-only"><caption>Weekly habit completion</caption><thead><tr><th>Day</th><th>Done</th><th>Planned</th></tr></thead><tbody>{weekly.map((w) => <tr key={w.d}><td>{w.d}</td><td>{w.done}</td><td>{w.planned}</td></tr>)}</tbody></table>
        </Panel>
      </div>

      <Panel title="All habits">
        {!habits ? <SkeletonRows /> : (
          <ul className="grid gap-2 md:grid-cols-2">
            {habits.map((h) => {
              const s = streak(h, logs, today);
              const last14 = Array.from({ length: 14 }, (_, i) => toDateKey(subDays(new Date(), 13 - i)));
              return (
                <li key={h.id} className={cn("flex items-center gap-3 rounded-xl border border-border p-3", !h.is_active && "opacity-50")}>
                  <span className={`grid size-10 shrink-0 place-items-center rounded-xl bg-${h.color}/15`} style={{ color: `var(--${h.color === "pink" ? "coral" : h.color})` }}>{habitIcon(h.kind, 20)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{h.name} {h.is_essential ? <span className="text-xs text-muted-foreground">· essential</span> : null}</p>
                    <p className="text-xs text-muted-foreground">{h.kind} · {h.schedule_days.length === 7 ? "daily" : h.schedule_days.map((d) => DAY_LABELS[d].slice(0, 3)).join(", ")}{h.times.length ? ` · ${h.times.join(", ")}` : ""}{h.target_per_day > 1 ? ` · ${h.target_per_day} ${h.unit ?? ""}/day` : ""}</p>
                    <div className="mt-1 flex gap-0.5" aria-label={`Last 14 days`}>
                      {last14.map((d) => {
                        const l = logs.find((x) => x.habit_id === h.id && x.log_date === d);
                        const scheduled = h.schedule_days.includes(new Date(d + "T00:00:00").getDay());
                        return <span key={d} title={`${d}: ${l?.status ?? (scheduled ? "no entry" : "rest day")}`} className={cn("h-2.5 w-3 rounded-sm", l?.status === "done" ? "bg-mint" : l?.status === "skipped" ? "bg-amber" : l?.status === "missed" ? "bg-coral/60" : scheduled ? "bg-muted" : "bg-transparent border border-border")} />;
                      })}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{s > 0 ? `${s} in a row` : "Fresh start today"}{h.notes ? ` · ${h.notes}` : ""}</p>
                  </div>
                  <Button size="icon-sm" variant="ghost" aria-label={`Edit ${h.name}`} onClick={() => setDlg({ habit: h })}><IconEdit size={14} /></Button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <HabitDialog open={Boolean(dlg)} onOpenChange={(o) => !o && setDlg(null)} habit={dlg?.habit ?? null} onDelete={(h) => { setDlg(null); setDel(h); }} onMarkMissed={async (h) => { await logHabit(userId, h, today, "missed"); toast("Marked missed for today. Tomorrow is a new day."); setDlg(null); }} />
      <ConfirmDialog open={Boolean(del)} onOpenChange={(o) => !o && setDel(null)} title={`Delete ${del?.name}?`} body="Its history will be removed too. You can archive instead by turning it off." confirmLabel="Delete" destructive onConfirm={async () => { if (del) await remove("habits", userId, del.id); }} />
    </div>
  );
}

function HabitDialog({ open, onOpenChange, habit, onDelete, onMarkMissed }: { open: boolean; onOpenChange: (o: boolean) => void; habit: Habit | null; onDelete: (h: Habit) => void; onMarkMissed: (h: Habit) => Promise<void> }) {
  const { userId } = useSession();
  const [f, setF] = useState({ name: "", kind: "habit" as Habit["kind"], days: [0, 1, 2, 3, 4, 5, 6], time: "", target: "1", unit: "", is_essential: false, notes: "", is_active: true, reminder_level: "gentle" as Habit["reminder_level"], color: "mint" });
  const reset = () => setF({ name: habit?.name ?? "", kind: habit?.kind ?? "habit", days: habit?.schedule_days ?? [0, 1, 2, 3, 4, 5, 6], time: habit?.times[0] ?? "", target: String(habit?.target_per_day ?? 1), unit: habit?.unit ?? "", is_essential: habit?.is_essential ?? false, notes: habit?.notes ?? "", is_active: habit?.is_active ?? true, reminder_level: habit?.reminder_level ?? "gentle", color: habit?.color ?? "mint" });
  const save = async () => {
    const data = { name: f.name.trim(), kind: f.kind, schedule_days: f.days, times: f.time ? [f.time] : [], target_per_day: Math.max(1, Number(f.target) || 1), unit: f.unit.trim() || null, is_essential: f.is_essential, notes: f.notes.trim() || null, is_active: f.is_active, reminder_level: f.reminder_level, color: f.color };
    if (habit) await update("habits", userId, habit.id, data); else await insert("habits", userId, data);
    toast.success("Habit saved"); onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-3">
          <DialogHeader><DialogTitle>{habit ? "Edit habit" : "New habit"}</DialogTitle><DialogDescription>Choose days, an optional time, and how firmly to remind you.</DialogDescription></DialogHeader>
          <Field label="Name" htmlFor="h-name"><Input id="h-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required autoFocus /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type" htmlFor="h-kind"><select id="h-kind" className="tap w-full rounded-lg border border-input bg-background px-3 text-sm" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Habit["kind"] })}><option value="habit">Habit</option><option value="medicine">Medicine</option><option value="exercise">Exercise</option><option value="water">Water</option><option value="sleep">Sleep</option><option value="rehab">Rehabilitation</option></select></Field>
            <Field label="Time" htmlFor="h-time"><Input id="h-time" type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
            <Field label="Times per day" htmlFor="h-target"><Input id="h-target" type="number" min={1} value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} /></Field>
            <Field label="Unit" htmlFor="h-unit"><Input id="h-unit" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="glasses, reps" /></Field>
            <Field label="Reminder" htmlFor="h-level"><select id="h-level" className="tap w-full rounded-lg border border-input bg-background px-3 text-sm" value={f.reminder_level} onChange={(e) => setF({ ...f, reminder_level: e.target.value as Habit["reminder_level"] })}><option value="gentle">Gentle</option><option value="important">Important</option><option value="persistent">Persistent</option></select></Field>
            <Field label="Colour" htmlFor="h-color"><select id="h-color" className="tap w-full rounded-lg border border-input bg-background px-3 text-sm" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })}><option value="mint">Mint</option><option value="primary">Blue</option><option value="amber">Amber</option><option value="coral">Coral</option><option value="violet">Violet</option></select></Field>
          </div>
          <fieldset><legend className="mb-1 text-sm font-medium">Days</legend><div className="flex gap-1">{DAYS.map((d, i) => <button key={i} type="button" aria-label={DAY_LABELS[i]} aria-pressed={f.days.includes(i)} onClick={() => setF({ ...f, days: f.days.includes(i) ? f.days.filter((x) => x !== i) : [...f.days, i].sort() })} className={cn("tap grid size-11 place-items-center rounded-full border text-sm", f.days.includes(i) ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{d}</button>)}</div></fieldset>
          <Field label="Notes" htmlFor="h-notes"><Input id="h-notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="With food, 5 reps each side…" /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={f.is_essential} onChange={(e) => setF({ ...f, is_essential: e.target.checked })} /> Essential (shown on Today)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} /> Active</label>
          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex gap-2">{habit ? <><Button type="button" variant="destructive" onClick={() => onDelete(habit)}>Delete</Button><Button type="button" variant="outline" onClick={() => onMarkMissed(habit)}>Mark missed today</Button></> : null}</div>
            <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={!f.name.trim() || f.days.length === 0}>Save</Button></div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
