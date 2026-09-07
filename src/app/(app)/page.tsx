"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useSession } from "@/lib/session/session-provider";
import { useRows, useCurrency } from "@/lib/data/hooks";
import { todayKey, greetingFor, formatTime, formatDateHuman } from "@/lib/dates";
import { itemsForDay, overdueTasks, rescheduleAllOverdue, effectiveTaskStatus, type DayItem } from "@/lib/schedule/day";
import { formatMoney } from "@/lib/format";
import { PageHeader, Panel, EmptyState, SkeletonRows, StatusPill } from "@/components/common";
import { DayTimeline } from "@/components/today/timeline";
import { TaskRow } from "@/components/today/task-row";
import { HabitChecklist } from "@/components/habits/habit-checklist";
import { SafeToSpendCard } from "@/components/money/safe-to-spend-card";
import { TaskDialog } from "@/components/calendar/task-dialog";
import { EventDialog } from "@/components/calendar/event-dialog";
import { Button } from "@/components/ui/button";
import { IconArrowRight, IconInbox, IconMoon, IconPlus, IconSun } from "@/components/icons";
import { useUI } from "@/store/ui";
import { GettingStarted } from "@/components/today/getting-started";
import type { CalendarEvent, Task } from "@/lib/types";

export default function TodayPage() {
  const { profile, ready } = useSession();
  const currency = useCurrency();
  const openCapture = useUI((s) => s.openCapture);
  const openExpense = useUI((s) => s.openExpense);
  const today = todayKey();
  const now = new Date();
  const tasks = useRows("tasks");
  const events = useRows("events");
  const routines = useRows("routines");
  const habits = useRows("habits");
  const habitLogs = useRows("habit_logs");
  const inbox = useRows("inbox_items");
  const bills = useRows("bills");
  const reviews = useRows("daily_reviews");
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [newTask, setNewTask] = useState(false);
  const { userId } = useSession();

  const items = useMemo(() => (tasks && events && routines ? itemsForDay(today, tasks, events, routines) : []), [today, tasks, events, routines]);
  const loading = !ready || !tasks || !events || !habits || !habitLogs || !inbox || !bills;

  const nowMs = now.getTime();
  const current = items.find((i) => i.start && i.end && i.start.getTime() <= nowMs && i.end.getTime() > nowMs && i.status !== "done");
  const nowTask = current ?? items.find((i) => i.kind === "task" && i.status === "todo" && i.start && i.start.getTime() >= nowMs) ?? items.find((i) => i.kind === "task" && effectiveTaskStatus(i.source as Task, today) === "todo");
  const nextEvent = items.find((i) => i.kind === "event" && i.start && i.start.getTime() > nowMs && i.status === "scheduled");
  const overdue = tasks ? overdueTasks(tasks, today) : [];
  const dayTasks = items.filter((i): i is DayItem & { source: Task } => i.kind === "task");
  const topThree = dayTasks.filter((i) => (i.source as Task).is_top_priority).slice(0, 3);
  const others = dayTasks.filter((i) => !(i.source as Task).is_top_priority);
  const unprocessed = (inbox ?? []).filter((i) => i.status === "unprocessed").sort((a, b) => b.captured_at.localeCompare(a.captured_at));
  const dueBills = (bills ?? []).filter((b) => b.status === "active" && b.next_due_on <= format(new Date(now.getTime() + 7 * 86400000), "yyyy-MM-dd")).sort((a, b) => a.next_due_on.localeCompare(b.next_due_on));
  const morning = (reviews ?? []).find((r) => r.review_date === today && r.kind === "morning");
  const evening = (reviews ?? []).find((r) => r.review_date === today && r.kind === "evening");
  const doneCount = dayTasks.filter((i) => effectiveTaskStatus(i.source as Task, today) === "done").length;

  const onSelect = (it: DayItem) => {
    if (it.kind === "task") setEditTask(it.source as Task);
    else if (it.kind === "event") setEditEvent(it.source as CalendarEvent);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${greetingFor(now)}${profile?.display_name ? `, ${profile.display_name}` : ""}`}
        subtitle={<span>{format(now, "EEEE, d MMMM")} · {doneCount}/{dayTasks.length} tasks done</span>}
        actions={
          <>
            <Button variant={morning?.completed_at ? "outline" : "default"} size="sm" nativeButton={false} render={<Link href="/review?kind=morning" />}><IconSun size={16} /> {morning?.completed_at ? "Plan set" : "Morning plan"}</Button>
            <Button variant={evening?.completed_at ? "outline" : "secondary"} size="sm" nativeButton={false} render={<Link href="/review?kind=evening" />}><IconMoon size={16} /> {evening?.completed_at ? "Reviewed" : "Evening review"}</Button>
          </>
        }
      />

      {!loading ? <GettingStarted onAddTask={() => setNewTask(true)} /> : null}

      <Panel title="Your day" action={<Button size="sm" variant="ghost" onClick={() => setNewTask(true)}><IconPlus size={16} /> Add</Button>}>
        {loading ? <div className="skeleton h-24 rounded-xl" /> : items.length === 0 ? (
          <EmptyState title="Nothing planned for today" body="Add a task with a time and it appears on this timeline." action={<div className="flex gap-2"><Button size="sm" onClick={() => setNewTask(true)}><IconPlus size={16} /> Add task</Button><Button size="sm" variant="outline" nativeButton={false} render={<Link href="/calendar" />}>Open calendar</Button></div>} />
        ) : <DayTimeline items={items} isToday onSelect={onSelect} />}
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Now" className="border-l-4 border-l-primary">
          {loading ? <SkeletonRows rows={1} /> : nowTask ? (
            <button onClick={() => onSelect(nowTask)} className="w-full text-left">
              <p className="text-lg font-semibold">{nowTask.title}</p>
              <p className="text-sm text-muted-foreground">{nowTask.start ? `${formatTime(nowTask.start.toISOString())}${nowTask.end ? ` – ${formatTime(nowTask.end.toISOString())}` : ""}` : "Anytime today"}{nowTask.category ? ` · ${nowTask.category}` : ""}</p>
            </button>
          ) : (
            <div><p className="text-sm text-muted-foreground">Nothing scheduled right now.</p><div className="mt-2 flex flex-wrap gap-2"><Button size="sm" onClick={() => setNewTask(true)}>Add a task</Button><Button size="sm" variant="outline" onClick={() => openCapture()}>Capture a thought</Button></div></div>
          )}
          {nextEvent ? (
            <div className="mt-3 border-t border-border pt-3">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Next</p>
              <button onClick={() => onSelect(nextEvent)} className="text-left"><p className="font-medium">{nextEvent.title}</p><p className="text-sm text-muted-foreground">{formatTime(nextEvent.start!.toISOString())}{(nextEvent.source as CalendarEvent).location ? ` · ${(nextEvent.source as CalendarEvent).location}` : ""}</p></button>
            </div>
          ) : null}
        </Panel>
        <div className="space-y-2">
          <SafeToSpendCard />
          {!loading && !(bills ?? []).length && (profile?.monthly_income ?? 0) === 0 ? <p className="px-1 text-xs text-muted-foreground">Safe-to-spend is based on your income, bills and savings. <Link href="/settings" className="text-primary underline-offset-2 hover:underline">Set them in Settings</Link> or <button className="text-primary underline-offset-2 hover:underline" onClick={openExpense}>log an expense</button> to begin.</p> : null}
        </div>
      </div>

      {overdue.length > 0 ? (
        <Panel title={`Overdue (${overdue.length})`} className="border-l-4 border-l-coral" action={<Button size="sm" variant="outline" onClick={async () => { const n = await rescheduleAllOverdue(userId, overdue, today); toast.success(`${n} task${n === 1 ? "" : "s"} moved to today`); }}>Move all to today</Button>}>
          <div className="space-y-0.5">{overdue.slice(0, 6).map((t) => <TaskRow key={t.id} task={t} onEdit={setEditTask} showDate />)}</div>
        </Panel>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Top 3 priorities" action={<Button size="sm" variant="ghost" onClick={() => setNewTask(true)} aria-label="Add task"><IconPlus size={16} /></Button>}>
          {loading ? <SkeletonRows rows={3} /> : topThree.length === 0 ? (
            <EmptyState title="No priorities set" body="Pick up to three tasks that matter most today." action={<Button size="sm" variant="outline" nativeButton={false} render={<Link href="/review?kind=morning" />}>Plan the morning</Button>} />
          ) : (
            <ol className="space-y-0.5">{topThree.map((i, idx) => <li key={i.key} className="flex items-center gap-1"><span className="w-4 text-xs font-semibold text-muted-foreground tabular-nums">{idx + 1}</span><div className="flex-1"><TaskRow task={i.source as Task} onEdit={setEditTask} /></div></li>)}</ol>
          )}
          {others.length > 0 ? (
            <details className="mt-2">
              <summary className="tap cursor-pointer text-sm text-muted-foreground">{others.length} more task{others.length === 1 ? "" : "s"} today</summary>
              <div className="mt-1 space-y-0.5">{others.map((i) => <TaskRow key={i.key} task={i.source as Task} onEdit={setEditTask} />)}</div>
            </details>
          ) : null}
        </Panel>

        <Panel title="Essential habits" action={<Link href="/habits" className="text-sm text-primary">All habits</Link>}>
          {loading ? <SkeletonRows rows={3} /> : <HabitChecklist habits={habits ?? []} logs={habitLogs ?? []} dateKey={today} essentialOnly />}
        </Panel>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title={`Inbox · ${unprocessed.length} to sort`} action={<Link href="/inbox" className="flex items-center gap-1 text-sm text-primary">Process <IconArrowRight size={14} /></Link>}>
          {loading ? <SkeletonRows rows={2} /> : unprocessed.length === 0 ? (
            <EmptyState icon={<IconInbox size={28} />} title="Inbox zero" body="Everything you captured has a home." action={<Button size="sm" variant="outline" onClick={() => openCapture()}>Capture something</Button>} />
          ) : (
            <ul className="space-y-1">
              {unprocessed.slice(0, 4).map((i) => (
                <li key={i.id}><Link href="/inbox" className="block rounded-lg px-2 py-1.5 hover:bg-muted"><p className="truncate text-sm">{i.content || i.url}</p><p className="text-xs text-muted-foreground">{formatDateHuman(i.captured_at.slice(0, 10))} · {formatTime(i.captured_at)}</p></Link></li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Bills due soon" action={<Link href="/money?tab=bills" className="text-sm text-primary">Money</Link>}>
          {loading ? <SkeletonRows rows={2} /> : dueBills.length === 0 ? (
            <EmptyState title="Nothing due in the next 7 days" body="Add rent, utilities or EMIs and they are reserved before you spend." action={<Button size="sm" variant="outline" nativeButton={false} render={<Link href="/money?tab=bills" />}>Add a bill</Button>} />
          ) : (
            <ul className="space-y-1">
              {dueBills.map((b) => (
                <li key={b.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{b.name}</p><p className="text-xs text-muted-foreground">{formatDateHuman(b.next_due_on)}</p></div>
                  <span className="text-sm font-semibold tabular-nums">{formatMoney(b.amount, currency)}</span>
                  {b.next_due_on < today ? <StatusPill tone="coral">Overdue</StatusPill> : b.next_due_on === today ? <StatusPill tone="amber">Today</StatusPill> : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {morning?.intention ? <p className="px-1 text-center text-sm text-muted-foreground">Today&apos;s intention: <span className="text-foreground">“{morning.intention}”</span></p> : null}

      <TaskDialog open={Boolean(editTask)} onOpenChange={(o) => !o && setEditTask(null)} task={editTask} />
      <TaskDialog open={newTask} onOpenChange={setNewTask} defaultDate={today} />
      <EventDialog open={Boolean(editEvent)} onOpenChange={(o) => !o && setEditEvent(null)} event={editEvent} />
      {tasks && tasks.length === 0 && events && events.length === 0 && !loading ? (
        <EmptyState title="A clean slate" body="Add your first task or capture a thought and it will show up here." action={<Button onClick={() => setNewTask(true)}>Add a task</Button>} />
      ) : null}
    </div>
  );
}
