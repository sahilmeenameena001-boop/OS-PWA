"use client";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { useSession } from "@/lib/session/session-provider";
import { useUI } from "@/store/ui";
import { useRows, useRowsOr, useCurrency, useCategoryMap } from "@/lib/data/hooks";
import { insert, update, remove } from "@/lib/data/repo";
import { buildMemoryItems, matchesQuery, buildDailySummary, summaryToText, buildWeeklyReview, type MemoryItem } from "@/lib/memory/summary";
import { todayKey, toDateKey, formatDateHuman, formatTime } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { PageHeader, Panel, EmptyState, SkeletonRows, StatusPill, Field, ConfirmDialog } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IconPin, IconPlus, IconSearch, IconLink } from "@/components/icons";
import type { Note } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPES: { value: MemoryItem["type"] | "all"; label: string }[] = [
  { value: "all", label: "All" }, { value: "note", label: "Notes" }, { value: "capture", label: "Captures" }, { value: "task", label: "Done" }, { value: "event", label: "Events" }, { value: "expense", label: "Expenses" }, { value: "document", label: "Documents" },
];

function MemoryInner() {
  const params = useSearchParams();
  const { userId } = useSession();
  const openCapture = useUI((s) => s.openCapture);
  const currency = useCurrency();
  const notes = useRows("notes");
  const inbox = useRowsOr("inbox_items");
  const tasks = useRowsOr("tasks");
  const events = useRowsOr("events");
  const transactions = useRowsOr("transactions");
  const attachments = useRowsOr("attachments");
  const habits = useRowsOr("habits");
  const habitLogs = useRowsOr("habit_logs");
  const catMap = useCategoryMap();
  const categoryNames = useMemo(() => new Map([...catMap].map(([k, v]) => [k, v.name])), [catMap]);
  const [q, setQ] = useState("");
  const [type, setType] = useState<MemoryItem["type"] | "all">("all");
  const [onDate, setOnDate] = useState("");
  const [noteDlg, setNoteDlg] = useState<{ note: Note | null } | null>(null);
  const [del, setDel] = useState<Note | null>(null);
  const focus = params.get("focus");
  const today = todayKey();

  const items = useMemo(() => buildMemoryItems({ notes: notes ?? [], inbox, tasks, events, transactions, attachments, categoryNames }), [notes, inbox, tasks, events, transactions, attachments, categoryNames]);
  const filtered = useMemo(() => items.filter((i) => (type === "all" || i.type === type) && (!onDate || i.dateKey === onDate) && matchesQuery(i, q)), [items, type, onDate, q]);
  const pinned = (notes ?? []).filter((n) => n.pinned);
  const unresolved = items.filter((i) => i.type === "capture" && !i.resolved).slice(0, 5);
  const summary = useMemo(() => buildDailySummary({ dateKey: onDate || today, tasks, events, transactions, inbox, habits, habitLogs, currency }), [onDate, today, tasks, events, transactions, inbox, habits, habitLogs, currency]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => toDateKey(subDays(new Date(), 6 - i))), []);
  const weekly = useMemo(() => buildWeeklyReview({ days: weekDays, tasks, transactions, inbox, habits, habitLogs, categoryNames }), [weekDays, tasks, transactions, inbox, habits, habitLogs, categoryNames]);

  const grouped = useMemo(() => {
    const m = new Map<string, MemoryItem[]>();
    for (const i of filtered.slice(0, 400)) m.set(i.dateKey, [...(m.get(i.dateKey) ?? []), i]);
    return [...m.entries()];
  }, [filtered]);

  const noteFor = (item: MemoryItem) => (item.type === "note" ? (notes ?? []).find((n) => n.id === item.linkedId) ?? null : null);
  const related = (item: MemoryItem) => {
    const n = noteFor(item);
    const ids = new Set<string>(n?.related_ids ?? []);
    if (n?.source_inbox_id) ids.add(n.source_inbox_id);
    return items.filter((x) => ids.has(x.linkedId) && x.id !== item.id).slice(0, 3);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Memory" subtitle="Everything you did, noted, spent and captured, in order." actions={<Button size="sm" onClick={() => setNoteDlg({ note: null })}><IconPlus size={16} /> Note</Button>} />
      <div className="glass flex flex-wrap items-center gap-2 rounded-2xl p-2">
        <div className="relative min-w-48 flex-1"><IconSearch size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search memory" placeholder="Search everything…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" /></div>
        <Input type="date" aria-label="What did I do on this date?" value={onDate} max={today} onChange={(e) => setOnDate(e.target.value)} className="w-40" />
        {onDate ? <Button size="sm" variant="ghost" onClick={() => setOnDate("")}>Clear date</Button> : null}
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by type">{TYPES.map((t) => <button key={t.value} onClick={() => setType(t.value)} aria-pressed={type === t.value} className={cn("tap rounded-full border px-3 text-xs", type === t.value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>{t.label}</button>)}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Panel title={onDate ? `On ${formatDateHuman(onDate)}` : "Today so far"} className="md:col-span-1">
          <p className="text-sm">{summaryToText(summary)}</p>
          <dl className="mt-2 grid grid-cols-3 gap-1 text-center text-xs"><div className="rounded-lg bg-muted/60 p-1.5"><dt className="text-muted-foreground">Tasks</dt><dd className="font-semibold">{summary.tasksDone}</dd></div><div className="rounded-lg bg-muted/60 p-1.5"><dt className="text-muted-foreground">Spent</dt><dd className="font-semibold">{formatMoney(summary.spent, currency, { compact: true })}</dd></div><div className="rounded-lg bg-muted/60 p-1.5"><dt className="text-muted-foreground">Habits</dt><dd className="font-semibold">{summary.habitsDone}/{summary.habitsPlanned}</dd></div></dl>
        </Panel>
        <Panel title="This week" className="md:col-span-1">
          <ul className="space-y-1 text-sm">
            <li>{weekly.tasksDone} tasks completed{weekly.busiestDay ? `, busiest ${formatDateHuman(weekly.busiestDay)}` : ""}</li>
            <li>Spent {formatMoney(weekly.spent, currency)}{weekly.topCategories[0] ? `, mostly ${weekly.topCategories[0].name}` : ""}</li>
            <li>{weekly.captures} thoughts captured · habits {Math.round(weekly.habitRate * 100)}%</li>
          </ul>
        </Panel>
        <Panel title="Captured, not yet resolved" className="md:col-span-1">
          {unresolved.length === 0 ? <p className="text-sm text-muted-foreground">Nothing pending. Inbox is clear.</p> : <ul className="space-y-1 text-sm">{unresolved.map((u) => <li key={u.id} className="truncate">· {u.title}</li>)}</ul>}
        </Panel>
      </div>

      {pinned.length > 0 && !q && !onDate ? (
        <Panel title="Pinned">
          <ul className="grid gap-2 md:grid-cols-3">{pinned.map((n) => <li key={n.id}><button onClick={() => setNoteDlg({ note: n })} className="w-full rounded-xl border border-border bg-card/60 p-3 text-left hover:bg-muted"><p className="flex items-center gap-1 text-sm font-medium"><IconPin size={12} className="text-amber" /> {n.title || "Note"}</p><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.body}</p></button></li>)}</ul>
        </Panel>
      ) : null}

      {!notes ? <SkeletonRows rows={5} /> : grouped.length === 0 ? <EmptyState title={q || onDate ? "Nothing matches" : "Your memory is empty so far"} body={q || onDate ? "Try fewer or different words, or clear the date." : "Notes, captures, completed tasks and expenses all show up here in order."} action={q || onDate ? undefined : <div className="flex gap-2"><Button size="sm" onClick={() => setNoteDlg({ note: null })}><IconPlus size={16} /> Write a note</Button><Button size="sm" variant="outline" onClick={() => openCapture()}>Capture a thought</Button></div>} /> : (
        <div className="space-y-4">
          {grouped.map(([day, list]) => (
            <section key={day} aria-label={formatDateHuman(day)}>
              <h2 className="sticky top-14 z-10 mb-1 w-fit rounded-full bg-background/80 px-2 py-0.5 text-xs font-semibold text-muted-foreground backdrop-blur md:top-2">{formatDateHuman(day)} · {format(new Date(day + "T00:00:00"), "d MMM yyyy")}</h2>
              <ol className="relative ml-2 space-y-1 border-l border-border pl-4">
                {list.map((i) => {
                  const n = noteFor(i);
                  const rel = related(i);
                  return (
                    <li key={i.id} id={i.linkedId} className={cn("relative rounded-xl p-2 hover:bg-muted/50", focus === i.linkedId && "ring-2 ring-primary/50")}>
                      <span className="absolute top-4 -left-[21px] size-2.5 rounded-full border-2 border-background" style={{ background: `var(--${i.type === "expense" ? "amber" : i.type === "task" ? "mint" : i.type === "event" ? "violet" : i.type === "document" ? "coral" : "primary"})` }} aria-hidden="true" />
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <button onClick={() => n && setNoteDlg({ note: n })} className="text-left" disabled={!n}><p className="text-sm font-medium">{i.title}</p></button>
                          {i.body ? <p className="line-clamp-2 text-xs text-muted-foreground">{i.body}</p> : null}
                          <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground"><span>{formatTime(i.at)}</span><StatusPill tone="muted">{i.type}</StatusPill>{i.category ? <span>· {i.category}</span> : null}{i.amount != null ? <span className="tabular-nums">· {formatMoney(i.amount, currency)}</span> : null}{i.pinned ? <IconPin size={12} className="text-amber" /> : null}</p>
                          {rel.length ? <p className="mt-1 flex flex-wrap gap-1 text-xs">{rel.map((r) => <span key={r.id} className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-accent-foreground"><IconLink size={10} /> {r.title}</span>)}</p> : null}
                        </div>
                        {n ? <Button size="icon-sm" variant="ghost" aria-label={n.pinned ? "Unpin" : "Pin"} aria-pressed={n.pinned} onClick={() => update("notes", userId, n.id, { pinned: !n.pinned })}><IconPin size={14} className={n.pinned ? "text-amber" : ""} /></Button> : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}

      <NoteDialog open={Boolean(noteDlg)} onOpenChange={(o) => !o && setNoteDlg(null)} note={noteDlg?.note ?? null} allNotes={notes ?? []} onDelete={(n) => { setNoteDlg(null); setDel(n); }} />
      <ConfirmDialog open={Boolean(del)} onOpenChange={(o) => !o && setDel(null)} title="Delete this note?" confirmLabel="Delete" destructive onConfirm={async () => { if (del) { await remove("notes", userId, del.id); toast("Note deleted"); } }} />
    </div>
  );
}

function NoteDialog({ open, onOpenChange, note, allNotes, onDelete }: { open: boolean; onOpenChange: (o: boolean) => void; note: Note | null; allNotes: Note[]; onDelete: (n: Note) => void }) {
  const { userId } = useSession();
  const [f, setF] = useState({ title: "", body: "", kind: "note" as Note["kind"], tags: "", pinned: false, related: [] as string[] });
  const reset = () => setF({ title: note?.title ?? "", body: note?.body ?? "", kind: note?.kind ?? "note", tags: note?.tags.join(", ") ?? "", pinned: note?.pinned ?? false, related: note?.related_ids ?? [] });
  const save = async () => {
    const data = { title: f.title.trim(), body: f.body.trim(), kind: f.kind, tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean), pinned: f.pinned, related_ids: f.related };
    if (note) await update("notes", userId, note.id, data); else await insert("notes", userId, { ...data, source_inbox_id: null });
    toast.success("Note saved"); onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-3">
          <DialogHeader><DialogTitle>{note ? "Edit note" : "New note"}</DialogTitle><DialogDescription>Notes, ideas, contacts and lists live in your memory timeline.</DialogDescription></DialogHeader>
          <Field label="Title" htmlFor="n-title"><Input id="n-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus /></Field>
          <Field label="Body" htmlFor="n-body"><Textarea id="n-body" rows={5} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kind" htmlFor="n-kind"><select id="n-kind" className="tap w-full rounded-lg border border-input bg-background px-3 text-sm" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Note["kind"] })}><option value="note">Note</option><option value="idea">Idea</option><option value="contact">Contact</option><option value="shopping">Shopping</option><option value="document">Document</option></select></Field>
            <Field label="Tags" htmlFor="n-tags"><Input id="n-tags" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} placeholder="health, home" /></Field>
          </div>
          <Field label="Related notes" htmlFor="n-related"><select id="n-related" multiple className="h-24 w-full rounded-lg border border-input bg-background px-2 text-sm" value={f.related} onChange={(e) => setF({ ...f, related: [...e.target.selectedOptions].map((o) => o.value) })}>{allNotes.filter((n) => n.id !== note?.id).map((n) => <option key={n.id} value={n.id}>{n.title || n.body.slice(0, 40)}</option>)}</select></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked })} /> Pin to the top of Memory</label>
          <DialogFooter className="sm:justify-between">{note ? <Button type="button" variant="destructive" onClick={() => onDelete(note)}>Delete</Button> : <span />}<div className="flex gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={!f.body.trim()}>Save</Button></div></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function MemoryPage() {
  return <Suspense fallback={<SkeletonRows rows={5} />}><MemoryInner /></Suspense>;
}
