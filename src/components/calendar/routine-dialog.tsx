"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/lib/session/session-provider";
import { insert, remove, update } from "@/lib/data/repo";
import { newId } from "@/lib/ids";
import type { Routine, RoutineStep } from "@/lib/types";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, ConfirmDialog } from "@/components/common";
import { IconTrash, IconPlus } from "@/components/icons";
import { cn } from "@/lib/utils";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function RoutineDialog({ open, onOpenChange, routine, onApplyToday }: { open: boolean; onOpenChange: (o: boolean) => void; routine: Routine | null; onApplyToday?: (r: Routine) => Promise<void> }) {
  const { userId } = useSession();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Routine["kind"]>("custom");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState("08:00");
  const [duration, setDuration] = useState(30);
  const [steps, setSteps] = useState<RoutineStep[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(routine?.name ?? "");
    setKind(routine?.kind ?? "custom");
    setDays(routine?.days ?? [1, 2, 3, 4, 5]);
    setStartTime(routine?.start_time ?? "08:00");
    setDuration(routine?.duration_min ?? 30);
    setSteps(routine?.steps ?? []);
  }, [open, routine]);

  const save = async () => {
    if (!name.trim()) return;
    const data = { name: name.trim(), kind, days, start_time: startTime || null, duration_min: duration, steps, description: routine?.description ?? null, is_active: true };
    if (routine) await update("routines", userId, routine.id, data);
    else await insert("routines", userId, data);
    toast.success("Routine saved");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{routine ? "Edit routine" : "New routine or time block"}</DialogTitle>
            <DialogDescription>Routines appear on your timeline and can be applied as tasks in one tap.</DialogDescription>
          </DialogHeader>
          <Field label="Name" htmlFor="rt-name"><Input id="rt-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Type" htmlFor="rt-kind">
              <select id="rt-kind" className="tap w-full rounded-lg border border-input bg-background px-3 text-sm" value={kind} onChange={(e) => setKind(e.target.value as Routine["kind"])}>
                <option value="morning">Morning</option><option value="evening">Evening</option><option value="custom">Custom</option><option value="time_block">Time block</option>
              </select>
            </Field>
            <Field label="Start" htmlFor="rt-start"><Input id="rt-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></Field>
            <Field label="Minutes" htmlFor="rt-dur"><Input id="rt-dur" type="number" min={5} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></Field>
          </div>
          <fieldset>
            <legend className="mb-1 text-sm font-medium">Days</legend>
            <div className="flex gap-1">{DAYS.map((d, i) => <button key={i} type="button" aria-label={DAY_LABELS[i]} aria-pressed={days.includes(i)} onClick={() => setDays((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i].sort()))} className={cn("tap grid size-11 place-items-center rounded-full border text-sm", days.includes(i) ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{d}</button>)}</div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Steps</legend>
            {steps.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                <Input aria-label={`Step ${i + 1}`} value={s.title} onChange={(e) => setSteps((cur) => cur.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))} className="flex-1" />
                <Input aria-label={`Step ${i + 1} minutes`} type="number" min={1} value={s.minutes} onChange={(e) => setSteps((cur) => cur.map((x) => (x.id === s.id ? { ...x, minutes: Number(e.target.value) } : x)))} className="w-20" />
                <Button type="button" variant="ghost" size="icon" aria-label="Remove step" onClick={() => setSteps((cur) => cur.filter((x) => x.id !== s.id))}><IconTrash size={16} /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setSteps((cur) => [...cur, { id: newId(), title: "", minutes: 5 }])}><IconPlus size={14} /> Add step</Button>
          </fieldset>
          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex gap-2">
              {routine ? <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>Delete</Button> : null}
              {routine && onApplyToday && routine.steps.length ? <Button type="button" variant="secondary" onClick={() => { void onApplyToday(routine); onOpenChange(false); }}>Add steps as tasks</Button> : null}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={!name.trim()}>Save</Button>
            </div>
          </DialogFooter>
        </form>
        {routine ? <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title="Delete this routine?" confirmLabel="Delete" destructive onConfirm={async () => { await remove("routines", userId, routine.id); onOpenChange(false); }} /> : null}
      </DialogContent>
    </Dialog>
  );
}
