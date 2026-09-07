import { describe, expect, it } from "vitest";
import { getOne, insert, listAll, remove, update } from "@/lib/data/repo";
import { exportAll } from "@/lib/export";

const A = "user-a";
const B = "user-b";
const noteData = { title: "secret", body: "b", kind: "note" as const, tags: [], pinned: false, source_inbox_id: null, related_ids: [] };

describe("user data isolation (local repository mirrors RLS)", () => {
  it("scopes reads, updates, deletes and exports to the owning user", async () => {
    const a = await insert("notes", A, noteData);
    await insert("notes", B, noteData);
    expect((await listAll("notes", A)).map((n) => n.id)).toEqual([a.id]);
    expect(await getOne("notes", B, a.id)).toBeNull();
    expect(await update("notes", B, a.id, { title: "hacked" })).toBeNull();
    expect((await getOne("notes", A, a.id))?.title).toBe("secret");
    expect(await remove("notes", B, a.id)).toBe(false);
    expect(await getOne("notes", A, a.id)).toBeTruthy();
    const bundle = await exportAll(B);
    expect(bundle.tables.notes?.every((n) => n.user_id === B)).toBe(true);
    expect(bundle.tables.notes).toHaveLength(1);
  });

  it("stamps user_id on inserts regardless of payload", async () => {
    const row = await insert("notes", A, { ...noteData, user_id: B } as typeof noteData);
    expect(row.user_id).toBe(A);
  });
});
