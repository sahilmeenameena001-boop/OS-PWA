import { getDB, type OutboxEntry } from "@/lib/data/db";
import type { AuditAction, BaseRecord, TableMap, TableName } from "@/lib/types";
import { newId } from "@/lib/ids";

/**
 * Local-first repository. Every write lands in IndexedDB immediately, is recorded in
 * audit_events, and queued in the outbox for background sync to Supabase.
 * Financial records must never be silently modified: callers use `reverseTransaction`
 * (see money/ledger.ts) rather than editing amounts in place.
 */

const AUDITED: ReadonlySet<TableName> = new Set<TableName>([
  "transactions",
  "savings_contributions",
  "budgets",
  "bills",
  "subscriptions",
  "debts",
  "savings_goals",
  "accounts",
]);

export function outboxKey(table: TableName, recordId: string, op: OutboxEntry["op"], updatedAt: string): string {
  return `${table}:${recordId}:${op}:${updatedAt}`;
}

async function enqueue(entry: Omit<OutboxEntry, "attempts" | "status" | "error" | "created_at">): Promise<void> {
  const db = getDB();
  const existing = await db.outbox.get(entry.id);
  if (existing) return; // idempotent: identical write already queued
  await db.outbox.put({ ...entry, attempts: 0, status: "pending", error: null, created_at: new Date().toISOString() });
}

async function audit(userId: string, table: TableName, entityId: string, action: AuditAction, before: unknown, after: unknown): Promise<void> {
  if (!AUDITED.has(table)) return;
  const db = getDB();
  const now = new Date().toISOString();
  const row = {
    id: newId(),
    user_id: userId,
    entity_type: table,
    entity_id: entityId,
    action,
    before: before ?? null,
    after: after ?? null,
    occurred_at: now,
    created_at: now,
    updated_at: now,
  };
  await db.audit_events.put(row);
  await enqueue({ id: outboxKey("audit_events", row.id, "upsert", now), table: "audit_events", op: "upsert", record_id: row.id, user_id: userId, payload: row });
}

export async function insert<K extends TableName>(
  table: K,
  userId: string,
  data: Omit<TableMap[K], keyof BaseRecord> & Partial<Pick<BaseRecord, "id" | "created_at">>,
): Promise<TableMap[K]> {
  const db = getDB();
  const now = new Date().toISOString();
  const record = { ...data, id: data.id ?? newId(), user_id: userId, created_at: data.created_at ?? now, updated_at: now } as TableMap[K];
  await db.tbl(table).put(record);
  await audit(userId, table, record.id, "create", null, record);
  await enqueue({ id: outboxKey(table, record.id, "upsert", now), table, op: "upsert", record_id: record.id, user_id: userId, payload: record });
  return record;
}

export async function update<K extends TableName>(table: K, userId: string, id: string, patch: Partial<TableMap[K]>): Promise<TableMap[K] | null> {
  const db = getDB();
  const before = await db.tbl(table).get(id);
  if (!before || before.user_id !== userId) return null;
  const now = new Date().toISOString();
  const after = { ...before, ...patch, id, user_id: userId, updated_at: now } as TableMap[K];
  await db.tbl(table).put(after);
  await audit(userId, table, id, "update", before, after);
  await enqueue({ id: outboxKey(table, id, "upsert", now), table, op: "upsert", record_id: id, user_id: userId, payload: after });
  return after;
}

export async function remove<K extends TableName>(table: K, userId: string, id: string): Promise<boolean> {
  const db = getDB();
  const before = await db.tbl(table).get(id);
  if (!before || before.user_id !== userId) return false;
  await db.tbl(table).delete(id);
  await audit(userId, table, id, "delete", before, null);
  const now = new Date().toISOString();
  await enqueue({ id: outboxKey(table, id, "delete", now), table, op: "delete", record_id: id, user_id: userId, payload: { id } });
  return true;
}

export async function getOne<K extends TableName>(table: K, userId: string, id: string): Promise<TableMap[K] | null> {
  const row = await getDB().tbl(table).get(id);
  return row && row.user_id === userId ? row : null;
}

export async function listAll<K extends TableName>(table: K, userId: string): Promise<TableMap[K][]> {
  return getDB().tbl(table).where("user_id").equals(userId).toArray();
}

/** Write a record that came from the server: no audit, no outbox. */
export async function applyRemote<K extends TableName>(table: K, record: TableMap[K]): Promise<void> {
  const db = getDB();
  const local = await db.tbl(table).get(record.id);
  if (local && local.updated_at > record.updated_at) return; // local is newer; outbox will push it
  await db.tbl(table).put(record);
}

export async function pendingOutboxCount(): Promise<number> {
  return getDB().outbox.where("status").anyOf("pending", "failed").count();
}
