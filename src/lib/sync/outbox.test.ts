import { describe, expect, it, vi } from "vitest";
import { getDB } from "@/lib/data/db";
import { insert, update, remove, outboxKey } from "@/lib/data/repo";
import { pushOutbox } from "@/lib/sync/engine";
import type { SupabaseClient } from "@supabase/supabase-js";

const U = "user-a";
const noteData = { title: "n", body: "b", kind: "note" as const, tags: [], pinned: false, source_inbox_id: null, related_ids: [] };

function fakeSupabase(fail = false) {
  const calls: { table: string; op: string; payload?: unknown; id?: string }[] = [];
  const client = {
    from: (table: string) => ({
      upsert: async (payload: unknown) => {
        calls.push({ table, op: "upsert", payload });
        return { error: fail ? { message: "boom" } : null };
      },
      delete: () => ({
        eq: async (_col: string, id: string) => {
          calls.push({ table, op: "delete", id });
          return { error: fail ? { message: "boom" } : null };
        },
      }),
    }),
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe("offline outbox", () => {
  it("queues one entry per write and dedupes identical keys", async () => {
    const db = getDB();
    const n = await insert("notes", U, noteData);
    await update("notes", U, n.id, { title: "x" });
    const before = await db.outbox.count();
    // replaying the same key is a no-op
    await db.outbox.put({ id: outboxKey("notes", n.id, "upsert", n.updated_at), table: "notes", op: "upsert", record_id: n.id, user_id: U, payload: n, created_at: "", attempts: 0, status: "pending", error: null });
    expect(await db.outbox.count()).toBe(before);
    expect(before).toBe(2);
  });

  it("pushes pending entries in order, marks synced, and never sends another user's rows", async () => {
    const db = getDB();
    const a = await insert("notes", U, noteData);
    await insert("notes", "user-b", noteData);
    await remove("notes", U, a.id);
    const { client, calls } = fakeSupabase();
    const r = await pushOutbox(client, U);
    expect(r.synced).toBe(2);
    expect(calls.map((c) => c.op)).toEqual(["upsert", "delete"]);
    expect(await db.outbox.where("status").equals("pending").count()).toBe(1); // user-b's row stays pending for its own session
    // second push sends nothing new
    calls.length = 0;
    await pushOutbox(client, U);
    expect(calls).toHaveLength(0);
  });

  it("keeps failed entries with an error and retries them later", async () => {
    const db = getDB();
    await insert("notes", U, noteData);
    const bad = fakeSupabase(true);
    const r1 = await pushOutbox(bad.client, U);
    expect(r1.failed).toBe(1);
    const failed = await db.outbox.where("status").equals("failed").first();
    expect(failed?.error).toBe("boom");
    expect(failed?.attempts).toBe(1);
    const good = fakeSupabase();
    const r2 = await pushOutbox(good.client, U);
    expect(r2.synced).toBe(1);
    expect(await db.outbox.where("status").equals("failed").count()).toBe(0);
  });

  it("does not lose user input when navigator is offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const n = await insert("notes", U, noteData);
    expect(await getDB().notes.get(n.id)).toBeTruthy();
    expect(await getDB().outbox.where("record_id").equals(n.id).count()).toBe(1);
    vi.unstubAllGlobals();
  });
});
