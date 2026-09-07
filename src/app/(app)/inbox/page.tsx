"use client";
import { useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/lib/session/session-provider";
import { useRows, useRowsOr, useCurrency } from "@/lib/data/hooks";
import { update, remove } from "@/lib/data/repo";
import { classifyInboxItem, parseAmount } from "@/lib/capture/capture";
import { formatDateHuman, formatTime } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { PageHeader, Panel, EmptyState, SkeletonRows, StatusPill, ConfirmDialog, SegmentedControl } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconInbox, IconLink, IconTrash, IconCheck } from "@/components/icons";
import { useUI } from "@/store/ui";
import type { Classification, InboxItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const KINDS: { value: Classification; label: string; needsWhen?: boolean; needsAmount?: boolean }[] = [
  { value: "task", label: "Task", needsWhen: true },
  { value: "reminder", label: "Reminder", needsWhen: true },
  { value: "event", label: "Event", needsWhen: true },
  { value: "expense", label: "Expense", needsAmount: true },
  { value: "note", label: "Note" },
  { value: "idea", label: "Idea" },
  { value: "shopping", label: "Shopping" },
  { value: "contact", label: "Contact" },
  { value: "document", label: "Document" },
  { value: "habit", label: "Habit" },
];

export default function InboxPage() {
  const { userId } = useSession();
  const items = useRows("inbox_items");
  const categories = useRowsOr("expense_categories").filter((c) => !c.is_archived);
  const accounts = useRowsOr("accounts").filter((a) => !a.is_archived);
  const currency = useCurrency();
  const announce = useUI((s) => s.announce);
  const openCapture = useUI((s) => s.openCapture);
  const [filter, setFilter] = useState<"unprocessed" | "classified" | "archived">("unprocessed");
  const [active, setActive] = useState<InboxItem | null>(null);
  const [kind, setKind] = useState<Classification | null>(null);
  const [when, setWhen] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [confirm, setConfirm] = useState<InboxItem | null>(null);
  const [busy, setBusy] = useState(false);

  const list = (items ?? []).filter((i) => i.status === filter).sort((a, b) => b.captured_at.localeCompare(a.captured_at));
  const unprocessedCount = (items ?? []).filter((i) => i.status === "unprocessed").length;

  const begin = (item: InboxItem, k: Classification) => {
    setActive(item);
    setKind(k);
    setTitle(item.content.split("\n")[0].slice(0, 140));
    setWhen(item.scheduled_for ? new Date(item.scheduled_for).toISOString().slice(0, 16) : "");
    const parsed = parseAmount(item.content);
    setAmount(parsed ? String(parsed) : "");
    setCategoryId("");
  };

  const confirmClassify = async () => {
    if (!active || !kind) return;
    setBusy(true);
    try {
      const spec = KINDS.find((k) => k.value === kind);
      await classifyInboxItem(userId, active, kind, {
        when: spec?.needsWhen && when ? new Date(when).toISOString() : null,
        amount: spec?.needsAmount ? Number(amount) || null : null,
        categoryId: categoryId || null,
        accountId: accounts[0]?.id ?? null,
        title: title || null,
      });
      announce(`Filed as ${spec?.label ?? kind}`);
      toast.success(`Filed as ${spec?.label ?? kind}`);
      setActive(null);
      setKind(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not classify");
    } finally {
      setBusy(false);
    }
  };

  const archive = async (item: InboxItem) => {
    await update("inbox_items", userId, item.id, { status: "archived" });
    toast("Archived");
  };
  const restore = async (item: InboxItem) => {
    await update("inbox_items", userId, item.id, { status: "unprocessed", classified_as: null, linked_id: null, linked_type: null });
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Inbox" subtitle={unprocessedCount === 0 ? "Inbox zero. Nice." : `${unprocessedCount} item${unprocessedCount === 1 ? "" : "s"} waiting for a home`} actions={<SegmentedControl value={filter} onChange={setFilter} ariaLabel="Inbox filter" options={[{ value: "unprocessed", label: "To sort" }, { value: "classified", label: "Filed" }, { value: "archived", label: "Archived" }]} />} />
      {!items ? <SkeletonRows rows={4} /> : list.length === 0 ? (
        <EmptyState icon={<IconInbox size={32} />} title={filter === "unprocessed" ? "Nothing to sort" : "Nothing here"} body={filter === "unprocessed" ? "Capture a thought and it lands here first. Sort it when you have a moment." : undefined} action={filter === "unprocessed" ? <Button onClick={() => openCapture()}>Quick capture</Button> : undefined} />
      ) : (
        <ul className="space-y-3">
          {list.map((item) => {
            const isActive = active?.id === item.id;
            const spec = kind ? KINDS.find((k) => k.value === kind) : null;
            return (
              <li key={item.id}>
                <Panel as="article" className={cn(isActive && "ring-2 ring-primary/50")}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap text-sm">{item.content}</p>
                      {item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"><IconLink size={12} /> {item.url}</a> : null}
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDateHuman(item.captured_at.slice(0, 10))} · {formatTime(item.captured_at)}</span>
                        <StatusPill tone="muted">{item.kind}</StatusPill>
                        {item.scheduled_for ? <span>Planned {formatDateHuman(item.scheduled_for.slice(0, 10))}</span> : null}
                        {item.classified_as ? <StatusPill tone="mint"><IconCheck size={12} /> {item.classified_as}</StatusPill> : null}
                      </p>
                    </div>
                    {filter === "unprocessed" ? (
                      <div className="flex shrink-0 gap-1">
                        <Button variant="ghost" size="icon" aria-label="Archive" title="Archive" onClick={() => archive(item)}><IconInbox size={16} /></Button>
                        <Button variant="ghost" size="icon" aria-label="Delete" title="Delete" onClick={() => setConfirm(item)}><IconTrash size={16} /></Button>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => restore(item)}>Back to inbox</Button>
                    )}
                  </div>
                  {filter === "unprocessed" ? (
                    <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Classify as">
                      {KINDS.map((k) => (
                        <button key={k.value} onClick={() => begin(item, k.value)} aria-pressed={isActive && kind === k.value} className={cn("tap rounded-full border px-3 text-sm", isActive && kind === k.value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>{k.label}</button>
                      ))}
                    </div>
                  ) : null}
                  {isActive && spec ? (
                    <form onSubmit={(e) => { e.preventDefault(); void confirmClassify(); }} className="anim-rise mt-3 grid gap-3 rounded-xl bg-muted/50 p-3 sm:grid-cols-2">
                      <div className="space-y-1 sm:col-span-2"><Label htmlFor="cl-title">Title</Label><Input id="cl-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                      {spec.needsWhen ? <div className="space-y-1"><Label htmlFor="cl-when">When</Label><Input id="cl-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div> : null}
                      {spec.needsAmount ? (
                        <>
                          <div className="space-y-1"><Label htmlFor="cl-amount">Amount ({currency})</Label><Input id="cl-amount" type="number" inputMode="decimal" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
                          <div className="space-y-1"><Label htmlFor="cl-cat">Category</Label><select id="cl-cat" className="tap w-full rounded-lg border border-input bg-background px-3 text-sm" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Uncategorised</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                        </>
                      ) : null}
                      <div className="flex gap-2 sm:col-span-2">
                        <Button type="submit" disabled={busy || (spec.needsAmount && !(Number(amount) > 0))}>{busy ? "Filing…" : `File as ${spec.label}${spec.needsAmount && Number(amount) > 0 ? ` · ${formatMoney(Number(amount), currency)}` : ""}`}</Button>
                        <Button type="button" variant="ghost" onClick={() => { setActive(null); setKind(null); }}>Cancel</Button>
                      </div>
                    </form>
                  ) : null}
                </Panel>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog open={Boolean(confirm)} onOpenChange={(o) => !o && setConfirm(null)} title="Delete this capture?" body="It will be removed from your memory timeline too." confirmLabel="Delete" destructive onConfirm={async () => { if (confirm) { await remove("inbox_items", userId, confirm.id); toast("Deleted"); } }} />
    </div>
  );
}
