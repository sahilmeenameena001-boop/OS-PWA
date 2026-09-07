"use client";
import { Suspense, useMemo, useState, type DragEvent } from "react";
import { useSearchParams } from "next/navigation";
import { addDays, format, isSameDay } from "date-fns";
import { toast } from "sonner";
import { useSession } from "@/lib/session/session-provider";
import { useRows } from "@/lib/data/hooks";
import { todayKey, toDateKey, fromDateKey, weekDays, formatDateHuman, formatTime, minutesSinceMidnight } from "@/lib/dates";
import { itemsForDay, rescheduleTask, effectiveTaskStatus, type DayItem } from "@/lib/schedule/day";
import { update, insert } from "@/lib/data/repo";
import { PageHeader, Panel, EmptyState, SegmentedControl, SkeletonRows } from "@/components/common";
import { TaskRow } from "@/components/today/task-row";
import { TaskDialog } from "@/components/calendar/task-dialog";
import { EventDialog } from "@/components/calendar/event-dialog";
import { DayTimeline } from "@/components/today/timeline";
import { Button } from "@/components/ui/button";
import { IconChevronLeft, IconChevronRight, IconPlus, IconRepeat } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { CalendarEvent, Routine, Task } from "@/lib/types";
import { RoutineDialog } from "@/components/calendar/routine-dialog";

type View = "day" | "week" | "agenda";

function CalendarInner() {
  const params = useSearchParams();
  const { userId } = useSession();
  const [view, setView] = useState<View>((params.get("view") as View) || "day");
  const [anchor, setAnchor] = useState<string>(params.get("date") ?? todayKey());
  const tasks = useRows("tasks");
  const events = useRows("events");
  const routines = useRows("routines");
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [editRoutine, setEditRoutine] = useState<Routine | null | "new">(null);
  const [creating, setCreating] = useState<{ kind: "task" | "event"; date: string; time?: string } | null>(null);
  const loading = !tasks || !events || !routines;
  const today = todayKey();

  const shift = (n: number) => setAnchor(toDateKey(addDays(fromDateKey(anchor), view === "week" ? n * 7 : n)));

  const onSelect = (it: DayItem) => {
    if (it.kind === "task") setEditTask(it.source as Task);
    else if (it.kind === "event") setEditEvent(it.source as CalendarEvent);
    else setEditRoutine(it.source as Routine);
  };

  const onDrop = async (e: DragEvent, dateKey: string) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("text/plain");
    if (!data) return;
    const [kind, id] = data.split(":");
    if (kind === "task") {
      const t = tasks?.find((x) => x.id === id);
      if (t) {
        await rescheduleTask(userId, t, dateKey);
        toast.success(`Moved to ${formatDateHuman(dateKey)}`);
      }
    } else if (kind === "event") {
      const ev = events?.find((x) => x.id === id);
      if (ev) {
        const start = new Date(ev.start_at);
        const target = fromDateKey(dateKey);
        const dur = new Date(ev.end_at).getTime() - start.getTime();
        start.setFullYear(target.getFullYear(), target.getMonth(), target.getDate());
        await update("events", userId, ev.id, { start_at: start.toISOString(), end_at: new Date(start.getTime() + dur).toISOString() });
        toast.success(`Moved to ${formatDateHuman(dateKey)}`);
      }
    }
  };

  const setEventStatus = async (ev: CalendarEvent, status: CalendarEvent["status"]) => {
    if (status === "postponed") {
      const start = new Date(ev.start_at);
      const dur = new Date(ev.end_at).getTime() - start.getTime();
      start.setDate(start.getDate() + 1);
      await update("events", userId, ev.id, { start_at: start.toISOString(), end_at: new Date(start.getTime() + dur).toISOString(), status: "scheduled" });
      toast("Moved to tomorrow");
      return;
    }
    await update("events", userId, ev.id, { status });
    toast(status === "done" ? "Marked done" : status === "skipped" ? "Skipped" : "Updated");
  };

  const days = view === "week" ? weekDays(fromDateKey(anchor)) : [fromDateKey(anchor)];
  const agendaDays = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(fromDateKey(anchor), i)), [anchor]);

  const renderItem = (it: DayItem, dateKey: string) => {
    const draggable = it.kind !== "routine" && !(it.source as Task | CalendarEvent).recurrence;
    if (it.kind === "task") return <div key={it.key} draggable={draggable} onDragStart={(e) => e.dataTransfer.setData("text/plain", `task:${it.id}`)}><TaskRow task={it.source as Task} dateKey={dateKey} onEdit={setEditTask} /></div>;
    const ev = it.kind === "event" ? (it.source as CalendarEvent) : null;
    return (
      <div key={it.key} draggable={draggable} onDragStart={(e) => e.dataTransfer.setData("text/plain", `event:${it.id}`)} className={cn("group flex items-center gap-2 rounded-xl border-l-4 px-2 py-1.5 hover:bg-muted/60", it.kind === "event" ? "border-l-violet" : "border-l-mint", it.status === "done" && "opacity-60", it.status === "skipped" && "opacity-50")}>
        <button onClick={() => onSelect(it)} className="min-w-0 flex-1 text-left">
          <p className={cn("truncate text-sm font-medium", it.status === "done" && "line-through")}>{it.title}</p>
          <p className="text-xs text-muted-foreground">
            {it.allDay ? "All day" : it.start ? `${format(it.start, "h:mm a")}${it.end ? ` – ${format(it.end, "h:mm a")}` : ""}` : ""}
            {ev?.location ? ` · ${ev.location}` : ""}
            {it.kind === "routine" ? " · routine" : ""}
            {ev?.recurrence ? " · repeats" : ""}
          </p>
        </button>
        {ev && ev.status === "scheduled" ? (
          <div className="flex shrink-0 gap-1 opacity-80 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
            <Button size="xs" variant="outline" onClick={() => setEventStatus(ev, "done")}>Done</Button>
            <Button size="xs" variant="ghost" onClick={() => setEventStatus(ev, "skipped")}>Skip</Button>
            <Button size="xs" variant="ghost" onClick={() => setEventStatus(ev, "postponed")}>+1d</Button>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Calendar"
        subtitle="Drag items between days on desktop. Recurring items follow their rule."
        actions={
          <>
            <SegmentedControl value={view} onChange={setView} ariaLabel="Calendar view" options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "agenda", label: "Agenda" }]} />
            <Button size="sm" variant="outline" onClick={() => setEditRoutine("new")}><IconRepeat size={16} /> Routine</Button>
            <Button size="sm" onClick={() => setCreating({ kind: "task", date: anchor })}><IconPlus size={16} /> Task</Button>
            <Button size="sm" variant="secondary" onClick={() => setCreating({ kind: "event", date: anchor })}><IconPlus size={16} /> Event</Button>
          </>
        }
      />
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Previous"><IconChevronLeft size={18} /></Button>
        <div className="text-center">
          <p className="font-semibold">{view === "week" ? `${format(days[0], "d MMM")} – ${format(days[6], "d MMM")}` : format(fromDateKey(anchor), "EEEE, d MMMM")}</p>
          {anchor !== today ? <button className="text-xs text-primary" onClick={() => setAnchor(today)}>Back to today</button> : <p className="text-xs text-muted-foreground">Today</p>}
        </div>
        <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Next"><IconChevronRight size={18} /></Button>
      </div>

      {view === "day" ? (
        <>
          <Panel>{loading ? <div className="skeleton h-24 rounded-xl" /> : <DayTimeline items={itemsForDay(anchor, tasks, events, routines)} isToday={anchor === today} onSelect={onSelect} />}</Panel>
          <Panel title="Schedule" as="div" onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, anchor)}>
            {loading ? <SkeletonRows /> : (() => {
              const items = itemsForDay(anchor, tasks, events, routines);
              if (items.length === 0) return <EmptyState title="Nothing planned" body="Add a task or event, or drag one here." action={<Button size="sm" onClick={() => setCreating({ kind: "task", date: anchor })}>Add task</Button>} />;
              return <div className="space-y-0.5">{items.map((it) => renderItem(it, anchor))}</div>;
            })()}
          </Panel>
          <HourGrid dateKey={anchor} items={loading ? [] : itemsForDay(anchor, tasks, events, routines)} onSlot={(time) => setCreating({ kind: "event", date: anchor, time })} onSelect={onSelect} />
        </>
      ) : null}

      {view === "week" ? (
        <div className="grid gap-2 md:grid-cols-7">
          {days.map((d) => {
            const key = toDateKey(d);
            const items = loading ? [] : itemsForDay(key, tasks, events, routines);
            const isToday = isSameDay(d, new Date());
            return (
              <section key={key} className={cn("glass min-h-40 rounded-2xl p-2", isToday && "ring-2 ring-primary/50")} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, key)} aria-label={format(d, "EEEE d MMMM")}>
                <header className="mb-1 flex items-center justify-between px-1">
                  <button onClick={() => { setAnchor(key); setView("day"); }} className="text-sm font-semibold">{format(d, "EEE d")}</button>
                  <button onClick={() => setCreating({ kind: "task", date: key })} className="tap grid place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label={`Add on ${format(d, "EEEE")}`}><IconPlus size={14} /></button>
                </header>
                <div className="space-y-0.5">
                  {items.map((it) => (
                    <button key={it.key} draggable={it.kind !== "routine"} onDragStart={(e) => e.dataTransfer.setData("text/plain", `${it.kind}:${it.id}`)} onClick={() => onSelect(it)} className={cn("block w-full truncate rounded-md border-l-2 px-1.5 py-1 text-left text-xs hover:bg-muted", `border-l-${it.color}`, (it.status === "done" || (it.kind === "task" && effectiveTaskStatus(it.source as Task, key) === "done")) && "line-through opacity-60")} style={{ borderLeftColor: `var(--${it.color})` }}>
                      {it.start ? <span className="text-muted-foreground tabular-nums">{format(it.start, "H:mm")} </span> : null}{it.title}
                    </button>
                  ))}
                  {items.length === 0 ? <p className="px-1 py-2 text-xs text-muted-foreground">Free</p> : null}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}

      {view === "agenda" ? (
        <div className="space-y-3">
          {agendaDays.map((d) => {
            const key = toDateKey(d);
            const items = loading ? [] : itemsForDay(key, tasks, events, routines);
            if (items.length === 0) return null;
            return (
              <Panel key={key} title={formatDateHuman(key)} as="section" onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, key)}>
                <div className="space-y-0.5">{items.map((it) => renderItem(it, key))}</div>
              </Panel>
            );
          })}
          {!loading && agendaDays.every((d) => itemsForDay(toDateKey(d), tasks, events, routines).length === 0) ? <EmptyState title="Nothing in the next two weeks" body="A clear runway. Add what matters." /> : null}
        </div>
      ) : null}

      <TaskDialog open={Boolean(editTask)} onOpenChange={(o) => !o && setEditTask(null)} task={editTask} />
      <EventDialog open={Boolean(editEvent)} onOpenChange={(o) => !o && setEditEvent(null)} event={editEvent} />
      <TaskDialog open={creating?.kind === "task"} onOpenChange={(o) => !o && setCreating(null)} defaultDate={creating?.date} />
      <EventDialog open={creating?.kind === "event"} onOpenChange={(o) => !o && setCreating(null)} defaultDate={creating?.date} defaultStart={creating?.time} />
      <RoutineDialog open={editRoutine !== null} onOpenChange={(o) => !o && setEditRoutine(null)} routine={editRoutine === "new" ? null : editRoutine} onApplyToday={async (r) => { const key = anchor; for (const step of r.steps) { await insert("tasks", userId, { title: step.title, description: null, status: "todo", priority: 3, category: r.name, due_on: key, scheduled_start: null, scheduled_end: null, completed_at: null, recurrence: null, reminder_offsets: [], routine_id: r.id, is_top_priority: false, sort_order: 0, source_inbox_id: null }); } toast.success(`${r.steps.length} steps added to ${formatDateHuman(key)}`); }} />
    </div>
  );
}

function HourGrid({ dateKey, items, onSlot, onSelect }: { dateKey: string; items: DayItem[]; onSlot: (time: string) => void; onSelect: (it: DayItem) => void }) {
  const hours = Array.from({ length: 17 }, (_, i) => i + 6);
  const timed = items.filter((i) => i.start && i.end);
  const isToday = dateKey === todayKey();
  const nowMin = minutesSinceMidnight(new Date());
  return (
    <Panel title="Hours" className="hidden md:block">
      <div className="relative">
        {hours.map((h) => (
          <div key={h} className="flex h-14 border-t border-border">
            <button onClick={() => onSlot(`${String(h).padStart(2, "0")}:00`)} className="w-14 shrink-0 pt-1 text-left text-xs text-muted-foreground hover:text-primary" aria-label={`Add event at ${h}:00`}>{h > 12 ? `${h - 12} pm` : h === 12 ? "12 pm" : `${h} am`}</button>
            <div className="flex-1" />
          </div>
        ))}
        <div className="pointer-events-none absolute inset-y-0 left-14 right-0">
          {timed.map((it) => {
            const top = ((minutesSinceMidnight(it.start!) - 360) / 60) * 56;
            const height = Math.max(24, ((it.end!.getTime() - it.start!.getTime()) / 3_600_000) * 56);
            if (top < 0 || top > 17 * 56) return null;
            return (
              <button key={it.key} onClick={() => onSelect(it)} className={cn("pointer-events-auto absolute left-1 right-1 overflow-hidden rounded-lg border-l-4 bg-card/90 px-2 py-1 text-left text-xs shadow-sm hover:bg-muted", it.status === "done" && "opacity-50")} style={{ top, height, borderLeftColor: `var(--${it.color})` }}>
                <span className="font-medium">{it.title}</span> <span className="text-muted-foreground">{formatTime(it.start!.toISOString())}</span>
              </button>
            );
          })}
          {isToday && nowMin >= 360 && nowMin <= 23 * 60 ? <div className="absolute left-0 right-0 h-0.5 bg-primary" style={{ top: ((nowMin - 360) / 60) * 56 }} aria-hidden="true" /> : null}
        </div>
      </div>
    </Panel>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<SkeletonRows rows={4} />}>
      <CalendarInner />
    </Suspense>
  );
}
