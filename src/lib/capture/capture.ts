import { getDB } from "@/lib/data/db";
import { insert, update } from "@/lib/data/repo";
import { newId } from "@/lib/ids";
import { nowIso, todayKey } from "@/lib/dates";
import { recordTransaction } from "@/lib/money/ledger";
import type { Classification, InboxItem, InboxKind, NoteKind } from "@/lib/types";

export interface CaptureDraft {
  clientId: string;
  content: string;
  url: string;
  scheduledFor: string; // datetime-local value or ""
  updatedAt: string;
}

const DRAFT_KEY = "capture:draft";

export async function loadDraft(): Promise<CaptureDraft | null> {
  const row = await getDB().kv.get(DRAFT_KEY);
  return (row?.value as CaptureDraft | undefined) ?? null;
}

export async function saveDraft(draft: CaptureDraft): Promise<void> {
  await getDB().kv.put({ key: DRAFT_KEY, value: draft });
}

export async function clearDraft(): Promise<void> {
  await getDB().kv.delete(DRAFT_KEY);
}

export function newDraft(): CaptureDraft {
  return { clientId: newId(), content: "", url: "", scheduledFor: "", updatedAt: nowIso() };
}

export function detectKind(content: string, url: string, attachmentMime?: string | null): InboxKind {
  if (attachmentMime?.startsWith("image/")) return "photo";
  if (attachmentMime) return "file";
  if (url.trim()) return "link";
  return "text";
}

export function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s]+/i);
  return m ? m[0] : null;
}

export interface SaveCaptureInput {
  clientId: string;
  content: string;
  url?: string | null;
  attachmentId?: string | null;
  attachmentMime?: string | null;
  scheduledFor?: string | null;
  kind?: InboxKind;
}

/**
 * Saves immediately. Idempotent on clientId so a retried submit never duplicates.
 * Classification happens later in the Inbox.
 */
export async function saveCapture(userId: string, input: SaveCaptureInput): Promise<InboxItem> {
  const db = getDB();
  const existing = await db.inbox_items.where("client_id").equals(input.clientId).first();
  if (existing && existing.user_id === userId) return existing;
  const url = input.url?.trim() || extractUrl(input.content);
  return insert("inbox_items", userId, {
    client_id: input.clientId,
    content: input.content.trim(),
    kind: input.kind ?? detectKind(input.content, url ?? "", input.attachmentMime),
    url: url ?? null,
    attachment_id: input.attachmentId ?? null,
    captured_at: nowIso(),
    scheduled_for: input.scheduledFor || null,
    status: "unprocessed",
    classified_as: null,
    linked_type: null,
    linked_id: null,
  });
}

export interface ClassifyOptions {
  when?: string | null; // ISO datetime for task/event/reminder
  amount?: number | null;
  categoryId?: string | null;
  accountId?: string | null;
  title?: string | null;
}

/** Turn an inbox item into a first-class record and mark it classified. */
export async function classifyInboxItem(userId: string, item: InboxItem, as: Classification, opts: ClassifyOptions = {}): Promise<{ linkedType: string; linkedId: string }> {
  const title = (opts.title ?? item.content.split("\n")[0] ?? "Untitled").slice(0, 140) || "Untitled";
  const when = opts.when ?? item.scheduled_for;
  let linkedType = "notes";
  let linkedId = "";
  switch (as) {
    case "task": {
      const t = await insert("tasks", userId, {
        title,
        description: item.content.length > title.length ? item.content : null,
        status: "todo",
        priority: 3,
        category: null,
        due_on: when ? when.slice(0, 10) : todayKey(),
        scheduled_start: when ?? null,
        scheduled_end: null,
        completed_at: null,
        recurrence: null,
        reminder_offsets: [],
        routine_id: null,
        is_top_priority: false,
        sort_order: 0,
        source_inbox_id: item.id,
      });
      linkedType = "tasks";
      linkedId = t.id;
      break;
    }
    case "event": {
      const start = when ? new Date(when) : new Date();
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const e = await insert("events", userId, {
        title,
        description: null,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        all_day: false,
        location: null,
        category: null,
        recurrence: null,
        reminder_offsets: [10],
        status: "scheduled",
        source_inbox_id: item.id,
      });
      linkedType = "events";
      linkedId = e.id;
      break;
    }
    case "reminder": {
      const r = await insert("reminders", userId, {
        title,
        body: null,
        remind_at: when ?? new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        level: "important",
        status: "pending",
        snoozed_until: null,
        linked_type: "inbox_items",
        linked_id: item.id,
      });
      linkedType = "reminders";
      linkedId = r.id;
      break;
    }
    case "expense": {
      const amount = opts.amount ?? parseAmount(item.content);
      if (!amount) throw new Error("Enter an amount to file this as an expense");
      const tx = await recordTransaction(userId, {
        type: "expense",
        amount,
        category_id: opts.categoryId ?? null,
        account_id: opts.accountId ?? null,
        merchant: title.replace(/[\d.,₹$]+/g, "").trim() || null,
        note: item.content,
        source: "inbox",
        linked_type: "inbox_items",
        linked_id: item.id,
      });
      linkedType = "transactions";
      linkedId = tx.id;
      break;
    }
    case "habit": {
      const h = await insert("habits", userId, {
        name: title,
        kind: "habit",
        schedule_days: [0, 1, 2, 3, 4, 5, 6],
        times: [],
        target_per_day: 1,
        unit: null,
        is_essential: false,
        color: "mint",
        notes: null,
        is_active: true,
        reminder_level: "gentle",
      });
      linkedType = "habits";
      linkedId = h.id;
      break;
    }
    default: {
      const kindMap: Record<string, NoteKind> = { note: "note", idea: "idea", contact: "contact", shopping: "shopping", document: "document" };
      const n = await insert("notes", userId, {
        title,
        body: item.url ? `${item.content}\n${item.url}`.trim() : item.content,
        kind: kindMap[as] ?? "note",
        tags: [],
        pinned: false,
        source_inbox_id: item.id,
        related_ids: [],
      });
      linkedType = "notes";
      linkedId = n.id;
    }
  }
  await update("inbox_items", userId, item.id, { status: "classified", classified_as: as, linked_type: linkedType, linked_id: linkedId });
  return { linkedType, linkedId };
}

export function parseAmount(text: string): number | null {
  const m = text.replace(/,/g, "").match(/(?:₹|rs\.?|inr|\$)?\s*(\d+(?:\.\d{1,2})?)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}
