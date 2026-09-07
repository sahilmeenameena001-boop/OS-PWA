"use client";
import type { Recurrence, RecurrenceFrequency } from "@/lib/types";
import { fromDateKey } from "@/lib/dates";
import { cn } from "@/lib/utils";

const DAY_NAMES = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const FREQS: { value: RecurrenceFrequency | "none"; label: string }[] = [
  { value: "none", label: "Once" },
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Weekly" },
  { value: "custom", label: "Custom days" },
];

export function RecurrencePicker({ value, onChange, anchorDate }: { value: Recurrence | null; onChange: (r: Recurrence | null) => void; anchorDate: string }) {
  const freq = value?.frequency ?? "none";
  const days = value?.days ?? [fromDateKey(anchorDate).getDay()];
  const set = (f: RecurrenceFrequency | "none") => {
    if (f === "none") return onChange(null);
    onChange({ frequency: f, interval: 1, days: f === "weekly" || f === "custom" ? days : undefined, until: value?.until ?? null });
  };
  const toggleDay = (d: number) => {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort();
    onChange({ ...(value ?? { frequency: "custom" }), days: next.length ? next : [d] });
  };
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Repeat</legend>
      <div className="flex flex-wrap gap-1.5">
        {FREQS.map((f) => (
          <button key={f.value} type="button" onClick={() => set(f.value)} aria-pressed={freq === f.value} className={cn("tap rounded-full border px-3 text-sm", freq === f.value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>{f.label}</button>
        ))}
      </div>
      {freq === "weekly" || freq === "custom" ? (
        <div className="flex gap-1" role="group" aria-label="Days of week">
          {DAY_NAMES.map((n, i) => (
            <button key={i} type="button" onClick={() => toggleDay(i)} aria-pressed={days.includes(i)} aria-label={DAY_LABELS[i]} className={cn("tap grid size-11 place-items-center rounded-full border text-sm font-medium", days.includes(i) ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>{n}</button>
          ))}
        </div>
      ) : null}
      {value ? (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Until
          <input type="date" className="tap rounded-lg border border-input bg-background px-2 text-sm text-foreground" value={value.until ?? ""} onChange={(e) => onChange({ ...value, until: e.target.value || null })} aria-label="Repeat until" />
        </label>
      ) : null}
    </fieldset>
  );
}

const OFFSETS = [0, 5, 10, 15, 30, 60, 1440];
export function ReminderPicker({ value, onChange, disabled }: { value: number[]; onChange: (v: number[]) => void; disabled?: boolean }) {
  const toggle = (o: number) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o].sort((a, b) => a - b));
  const label = (o: number) => (o === 0 ? "At time" : o < 60 ? `${o} min before` : o < 1440 ? `${o / 60} h before` : "1 day before");
  return (
    <fieldset className="space-y-2" aria-disabled={disabled}>
      <legend className="text-sm font-medium">Reminders {disabled ? <span className="font-normal text-muted-foreground">(set a start time first)</span> : null}</legend>
      <div className="flex flex-wrap gap-1.5">
        {OFFSETS.map((o) => (
          <button key={o} type="button" disabled={disabled} onClick={() => toggle(o)} aria-pressed={value.includes(o)} className={cn("tap rounded-full border px-3 text-sm disabled:opacity-50", value.includes(o) ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>{label(o)}</button>
        ))}
      </div>
    </fieldset>
  );
}
