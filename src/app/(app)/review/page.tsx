"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useSession } from "@/lib/session/session-provider";
import { useRows, useRowsOr, useCurrency } from "@/lib/data/hooks";
import { insert, update } from "@/lib/data/repo";
import { getDB } from "@/lib/data/db";
import { todayKey, formatDateHuman } from "@/lib/dates";
import { itemsForDay, overdueTasks, rescheduleAllOverdue, effectiveTaskStatus, tomorrowKey } from "@/lib/schedule/day";
import { buildDailySummary, summaryToText } from "@/lib/memory/summary";
import { PageHeader, Panel, Field, SkeletonRows, SegmentedControl } from "@/components/common";
import { TaskRow } from "@/components/today/task-row";
import { HabitChecklist } from "@/components/habits/habit-checklist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IconSun, IconMoon } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

function ReviewInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { userId } = useSession();
  const currency = useCurrency();
  const kind = (params.get("kind") === "evening" ? "evening" : "morning") as "morning" | "evening";
  const today = todayKey();
  const tasks = useRows("tasks");
  const events = useRowsOr("events");
  const transactions = useRowsOr("transactions");
  const inbox = useRowsOr("inbox_items");
  const habits = useRowsOr("habits");
  const habitLogs = useRowsOr("habit_logs");
  const reviews = useRowsOr("daily_reviews");
  const existing = reviews.find((r) => r.review_date === today && r.kind === kind) ?? null;
  const [intention, setIntention] = useState("");
  const [wentWell, setWentWell] = useState("");
  const [improve, setImprove] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [newTask, setNewTask] = useState("");
  useEffect(() => { if (existing) { setIntention(existing.intention ?? ""); setWentWell(existing.went_well ?? ""); setImprove(existing.to_improve ?? ""); setMood(existing.mood); setEnergy(existing.energy); } }, [existing]);

  const dayTasks = useMemo(() => (tasks ? itemsForDay(today, tasks, [], []).map((i) => i.source as Task) : []), [tasks, today]);
  const top = dayTasks.filter((t) => t.is_top_priority);
  const overdue = tasks ? overdueTasks(tasks, today) : [];
  const unfinished = dayTasks.filter((t) => effectiveTaskStatus(t, today) === "todo");
  const summary = useMemo(() => buildDailySummary({ dateKey: today, tasks: tasks ?? [], events, transactions, inbox, habits, habitLogs, currency }), [today, tasks, events, transactions, inbox, habits, habitLogs, currency]);

  const toggleTop = async (t: Task) => {
    if (!t.is_top_priority && top.length >= 3) { toast("Three is enough. Un-star one first."); return; }
    await update("tasks", userId, t.id, { is_top_priority: !t.is_top_priority });
  };
  const addTask = async () => {
    if (!newTask.trim()) return;
    await insert("tasks", userId, { title: newTask.trim(), description: null, status: "todo", priority: 2, category: null, due_on: today, scheduled_start: null, scheduled_end: null, completed_at: null, recurrence: null, reminder_offsets: [], routine_id: null, is_top_priority: top.length < 3, sort_order: 0, source_inbox_id: null });
    setNewTask("");
  };
  const finish = async () => {
    const data = { review_date: today, kind, top_priorities: top.map((t) => t.title), intention: intention.trim() || null, went_well: wentWell.trim() || null, to_improve: improve.trim() || null, mood, energy, summary: kind === "evening" ? summary : null, completed_at: new Date().toISOString() };
    if (existing) await update("daily_reviews", userId, existing.id, data); else await insert("daily_reviews", userId, data);
    await getDB().kv.put({ key: `review:last:${kind}`, value: today });
    toast.success(kind === "morning" ? "Plan set. Have a good day." : "Review saved. Rest well.");
    router.push("/");
  };

  const Scale = ({ value, onChange, label }: { value: number | null; onChange: (v: number) => void; label: string }) => (
    <fieldset><legend className="mb-1 text-sm font-medium">{label}</legend><div className="flex gap-1" role="radiogroup">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${label} ${n} of 5`} onClick={() => onChange(n)} className={cn("tap flex-1 rounded-lg border text-sm", value === n ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>{n}</button>)}</div></fieldset>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={kind === "morning" ? "Morning plan" : "Evening review"} subtitle={formatDateHuman(today)} actions={<SegmentedControl value={kind} onChange={(v) => router.replace(`/review?kind=${v}`)} ariaLabel="Review type" options={[{ value: "morning", label: "Morning" }, { value: "evening", label: "Evening" }]} />} />
      {!tasks ? <SkeletonRows rows={4} /> : kind === "morning" ? (
        <>
          {overdue.length ? <Panel title={`${overdue.length} overdue from earlier`} className="border-l-4 border-l-coral"><Button size="sm" variant="outline" onClick={async () => { await rescheduleAllOverdue(userId, overdue, today); toast.success("Moved to today"); }}>Bring them all into today</Button></Panel> : null}
          <Panel title="Pick your top 3" action={<span className="text-xs text-muted-foreground">{top.length}/3</span>}>
            <ul className="space-y-0.5">{dayTasks.map((t) => <li key={t.id} className="flex items-center gap-1"><button onClick={() => toggleTop(t)} aria-pressed={t.is_top_priority} aria-label={`${t.is_top_priority ? "Remove" : "Set"} ${t.title} as top priority`} className={cn("tap grid place-items-center rounded-lg text-lg", t.is_top_priority ? "text-amber" : "text-muted-foreground hover:text-amber")}>★</button><div className="flex-1"><TaskRow task={t} compact /></div></li>)}</ul>
            <form onSubmit={(e) => { e.preventDefault(); void addTask(); }} className="mt-2 flex gap-2"><Input aria-label="Add a task for today" placeholder="Add a task for today…" value={newTask} onChange={(e) => setNewTask(e.target.value)} /><Button type="submit" variant="outline">Add</Button></form>
          </Panel>
          <Panel title="Essentials this morning"><HabitChecklist habits={habits} logs={habitLogs} dateKey={today} essentialOnly /></Panel>
          <Panel title="One line for the day"><Field label="Intention" htmlFor="rv-intention"><Input id="rv-intention" value={intention} onChange={(e) => setIntention(e.target.value)} placeholder="Calm and unhurried." /></Field><div className="mt-3"><Scale value={energy} onChange={setEnergy} label="Energy" /></div></Panel>
          <Button size="lg" className="w-full" onClick={finish}><IconSun size={18} /> Start the day</Button>
        </>
      ) : (
        <>
          <Panel title="Today in numbers"><p className="text-sm">{summaryToText(summary)}</p></Panel>
          {unfinished.length ? <Panel title={`${unfinished.length} unfinished`} action={<Button size="sm" variant="outline" onClick={async () => { await rescheduleAllOverdue(userId, unfinished, tomorrowKey(today)); toast.success("Moved to tomorrow"); }}>Move all to tomorrow</Button>}><ul className="space-y-0.5">{unfinished.map((t) => <li key={t.id}><TaskRow task={t} /></li>)}</ul></Panel> : null}
          <Panel title="Habits check"><HabitChecklist habits={habits} logs={habitLogs} dateKey={today} /></Panel>
          <Panel title="Reflect">
            <div className="space-y-3">
              <Field label="What went well?" htmlFor="rv-well"><Textarea id="rv-well" rows={2} value={wentWell} onChange={(e) => setWentWell(e.target.value)} /></Field>
              <Field label="What would make tomorrow easier?" htmlFor="rv-improve"><Textarea id="rv-improve" rows={2} value={improve} onChange={(e) => setImprove(e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-3"><Scale value={mood} onChange={setMood} label="Mood" /><Scale value={energy} onChange={setEnergy} label="Energy" /></div>
            </div>
          </Panel>
          <Button size="lg" className="w-full" onClick={finish}><IconMoon size={18} /> Close the day</Button>
        </>
      )}
    </div>
  );
}

export default function ReviewPage() {
  return <Suspense fallback={<SkeletonRows rows={4} />}><ReviewInner /></Suspense>;
}
