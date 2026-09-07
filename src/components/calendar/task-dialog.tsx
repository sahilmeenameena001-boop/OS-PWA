"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/lib/session/session-provider";
import { insert, remove, update } from "@/lib/data/repo";
import { todayKey, combineDateTime } from "@/lib/dates";
import type { Recurrence, RecurrenceFrequency, Task } from "@/lib/types";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, ConfirmDialog } from "@/components/common";
import { RecurrencePicker, ReminderPicker } from "@/components/calendar/pickers";

const PRIORITIES: { value: Task["priority"]; label: string }[] = [
  { value: 1, label: "Urgent" },
  { value: 2, label: "High" },
  { value: 3, label: "Normal" },
  { value: 4, label: "Low" },
];

export function TaskDialog({ open, onOpenChange, task, defaultDate, defaultTitle }: { open: boolean; onOpenChange: (o: boolean) => void; task?: Task | null; defaultDate?: string; defaultTitle?: string }) {
  const { userId } = useSession();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>(3);
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(defaultDate ?? todayKey());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence | null>(null);
  const [offsets, setOffsets] = useState<number[]>([]);
  const [top, setTop] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? defaultTitle ?? "");
    setDescription(task?.description ?? "");
    setPriority(task?.priority ?? 3);
    setCategory(task?.category ?? "");
    setDate(task?.due_on ?? defaultDate ?? todayKey());
    setStartTime(task?.scheduled_start ? new Date(task.scheduled_start).toTimeString().slice(0, 5) : "");
    setEndTime(task?.scheduled_end ? new Date(task.scheduled_end).toTimeString().slice(0, 5) : "");
    setRecurrence(task?.recurrence ?? null);
    setOffsets(task?.reminder_offsets ?? []);
    setTop(task?.is_top_priority ?? false);
  }, [open, task, defaultDate, defaultTitle]);

  const save = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const scheduled_start = startTime ? combineDateTime(date, startTime).toISOString() : null;
      const scheduled_end = startTime && endTime ? combineDateTime(date, endTime).toISOString() : scheduled_start ? new Date(new Date(scheduled_start).getTime() + 30 * 60_000).toISOString() : null;
      const data = { title: title.trim(), description: description.trim() || null, priority, category: category.trim() || null, due_on: date, scheduled_start, scheduled_end, recurrence, reminder_offsets: offsets, is_top_priority: top };
      if (task) await update("tasks", userId, task.id, data);
      else await insert("tasks", userId, { ...data, status: "todo", completed_at: null, routine_id: null, sort_order: 0, source_inbox_id: null });
      toast.success(task ? "Task updated" : "Task added");
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
            <DialogDescription>Set a day, an optional time, and how often it repeats.</DialogDescription>
          </DialogHeader>
          <Field label="Title" htmlFor="task-title"><Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus /></Field>
          <Field label="Notes" htmlFor="task-desc"><Textarea id="task-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></Field>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Day" htmlFor="task-date"><Input id="task-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
            <Field label="Start" htmlFor="task-start"><Input id="task-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></Field>
            <Field label="End" htmlFor="task-end"><Input id="task-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={!startTime} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority" htmlFor="task-priority">
              <select id="task-priority" className="tap w-full rounded-lg border border-input bg-background px-3 text-sm" value={priority} onChange={(e) => setPriority(Number(e.target.value) as Task["priority"])}>
                {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Category" htmlFor="task-category"><Input id="task-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Work, Home…" list="task-categories" /></Field>
            <datalist id="task-categories"><option value="Work" /><option value="Home" /><option value="Health" /><option value="Money" /><option value="Personal" /></datalist>
          </div>
          <RecurrencePicker value={recurrence} onChange={setRecurrence} anchorDate={date} />
          <ReminderPicker value={offsets} onChange={setOffsets} disabled={!startTime} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={top} onChange={(e) => setTop(e.target.checked)} /> Mark as a top-3 priority for the day</label>
          <DialogFooter className="gap-2 sm:justify-between">
            {task ? <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>Delete</Button> : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={busy || !title.trim()}>{busy ? "Saving…" : "Save"}</Button>
            </div>
          </DialogFooter>
        </form>
        {task ? (
          <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title="Delete this task?" body="This cannot be undone." confirmLabel="Delete" destructive onConfirm={async () => { await remove("tasks", userId, task.id); onOpenChange(false); toast("Task deleted"); }} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export type { RecurrenceFrequency };
