"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/lib/session/session-provider";
import { insert, remove, update } from "@/lib/data/repo";
import { todayKey, combineDateTime } from "@/lib/dates";
import type { CalendarEvent, Recurrence } from "@/lib/types";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, ConfirmDialog } from "@/components/common";
import { RecurrencePicker, ReminderPicker } from "@/components/calendar/pickers";

export function EventDialog({ open, onOpenChange, event, defaultDate, defaultStart }: { open: boolean; onOpenChange: (o: boolean) => void; event?: CalendarEvent | null; defaultDate?: string; defaultStart?: string }) {
  const { userId } = useSession();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(defaultDate ?? todayKey());
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [recurrence, setRecurrence] = useState<Recurrence | null>(null);
  const [offsets, setOffsets] = useState<number[]>([10]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(event?.title ?? "");
    setDescription(event?.description ?? "");
    setLocation(event?.location ?? "");
    setCategory(event?.category ?? "");
    setDate(event ? event.start_at.slice(0, 10) : defaultDate ?? todayKey());
    setAllDay(event?.all_day ?? false);
    setStartTime(event ? new Date(event.start_at).toTimeString().slice(0, 5) : defaultStart ?? "09:00");
    setEndTime(event ? new Date(event.end_at).toTimeString().slice(0, 5) : defaultStart ? `${String(Math.min(23, Number(defaultStart.slice(0, 2)) + 1)).padStart(2, "0")}${defaultStart.slice(2)}` : "10:00");
    setRecurrence(event?.recurrence ?? null);
    setOffsets(event?.reminder_offsets ?? [10]);
  }, [open, event, defaultDate, defaultStart]);

  const save = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const start = allDay ? combineDateTime(date, "00:00") : combineDateTime(date, startTime);
      let end = allDay ? combineDateTime(date, "23:59") : combineDateTime(date, endTime);
      if (end <= start) end = new Date(start.getTime() + 30 * 60_000);
      const data = { title: title.trim(), description: description.trim() || null, location: location.trim() || null, category: category.trim() || null, start_at: start.toISOString(), end_at: end.toISOString(), all_day: allDay, recurrence, reminder_offsets: offsets };
      if (event) await update("events", userId, event.id, data);
      else await insert("events", userId, { ...data, status: "scheduled", source_inbox_id: null });
      toast.success(event ? "Event updated" : "Event added");
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
            <DialogTitle>{event ? "Edit event" : "New event"}</DialogTitle>
            <DialogDescription>Times are in your local timezone.</DialogDescription>
          </DialogHeader>
          <Field label="Title" htmlFor="ev-title"><Input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus /></Field>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Day" htmlFor="ev-date"><Input id="ev-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
            <Field label="Start" htmlFor="ev-start"><Input id="ev-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={allDay} /></Field>
            <Field label="End" htmlFor="ev-end"><Input id="ev-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={allDay} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> All day</label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Location" htmlFor="ev-loc"><Input id="ev-loc" value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
            <Field label="Category" htmlFor="ev-cat"><Input id="ev-cat" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Work, Health…" /></Field>
          </div>
          <Field label="Notes" htmlFor="ev-desc"><Textarea id="ev-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></Field>
          <RecurrencePicker value={recurrence} onChange={setRecurrence} anchorDate={date} />
          <ReminderPicker value={offsets} onChange={setOffsets} />
          <DialogFooter className="gap-2 sm:justify-between">
            {event ? <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>Delete</Button> : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={busy || !title.trim()}>{busy ? "Saving…" : "Save"}</Button>
            </div>
          </DialogFooter>
        </form>
        {event ? <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title="Delete this event?" confirmLabel="Delete" destructive onConfirm={async () => { await remove("events", userId, event.id); onOpenChange(false); toast("Event deleted"); }} /> : null}
      </DialogContent>
    </Dialog>
  );
}
