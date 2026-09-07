"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDB, type OutboxEntry } from "@/lib/data/db";
import { applyRemote } from "@/lib/data/repo";
import { TABLE_NAMES, type TableMap, type TableName } from "@/lib/types";

export type SyncState = "idle" | "syncing" | "offline" | "error" | "local";

const MAX_ATTEMPTS = 8;
const PULL_ORDER: TableName[] = TABLE_NAMES; // parents before children by declaration order

/** Push pending outbox entries. Returns number of entries synced. */
export async function pushOutbox(supabase: SupabaseClient, userId: string): Promise<{ synced: number; failed: number }> {
  const db = getDB();
  const entries = await db.outbox.where("status").anyOf("pending", "failed").sortBy("created_at");
  let synced = 0;
  let failed = 0;
  for (const e of entries) {
    if (e.user_id !== userId) continue;
    if (e.attempts >= MAX_ATTEMPTS && e.status === "failed") {
      failed++;
      continue;
    }
    try {
      await applyEntry(supabase, e);
      await db.outbox.update(e.id, { status: "synced", error: null });
      synced++;
    } catch (err) {
      failed++;
      await db.outbox.update(e.id, { status: "failed", attempts: e.attempts + 1, error: err instanceof Error ? err.message : String(err) });
    }
  }
  // keep the synced history small
  const old = await db.outbox.where("status").equals("synced").sortBy("created_at");
  if (old.length > 200) await db.outbox.bulkDelete(old.slice(0, old.length - 200).map((o) => o.id));
  return { synced, failed };
}

async function applyEntry(supabase: SupabaseClient, e: OutboxEntry): Promise<void> {
  if (e.op === "delete") {
    const { error } = await supabase.from(e.table).delete().eq("id", e.record_id);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await supabase.from(e.table).upsert(e.payload as Record<string, unknown>, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

/** Pull rows updated since the last cursor for every table. */
export async function pullChanges(supabase: SupabaseClient, userId: string): Promise<number> {
  const db = getDB();
  const cursorRow = await db.kv.get(`sync:cursor:${userId}`);
  const since = typeof cursorRow?.value === "string" ? cursorRow.value : "1970-01-01T00:00:00Z";
  let maxSeen = since;
  let count = 0;
  for (const table of PULL_ORDER) {
    const { data, error } = await supabase.from(table).select("*").eq("user_id", userId).gt("updated_at", since).order("updated_at", { ascending: true }).limit(2000);
    if (error) throw new Error(`${table}: ${error.message}`);
    for (const row of (data ?? []) as TableMap[typeof table][]) {
      const clean = stripSearch(row);
      await applyRemote(table, clean);
      if (clean.updated_at > maxSeen) maxSeen = clean.updated_at;
      count++;
    }
  }
  await db.kv.put({ key: `sync:cursor:${userId}`, value: maxSeen });
  return count;
}

function stripSearch<T extends object>(row: T): T {
  if ("search" in row) {
    const { search: _search, ...rest } = row as T & { search?: unknown };
    void _search;
    return rest as T;
  }
  return row;
}

/** Detect server-side deletions by diffing ids (cheap for a single-user dataset). */
export async function reconcileDeletes(supabase: SupabaseClient, userId: string): Promise<void> {
  const db = getDB();
  for (const table of PULL_ORDER) {
    const { data, error } = await supabase.from(table).select("id").eq("user_id", userId);
    if (error) continue;
    const remote = new Set((data ?? []).map((r) => (r as { id: string }).id));
    const localIds = await db.tbl(table).where("user_id").equals(userId).primaryKeys();
    const pendingIds = new Set((await db.outbox.where("status").anyOf("pending", "failed").toArray()).map((o) => o.record_id));
    const toDelete = localIds.filter((id) => !remote.has(id) && !pendingIds.has(id));
    if (toDelete.length) await db.tbl(table).bulkDelete(toDelete);
  }
}

export async function fullSync(supabase: SupabaseClient, userId: string): Promise<void> {
  await pushOutbox(supabase, userId);
  await pullChanges(supabase, userId);
}
