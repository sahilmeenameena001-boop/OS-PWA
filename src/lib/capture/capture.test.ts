import { describe, expect, it } from "vitest";
import { getDB } from "@/lib/data/db";
import { classifyInboxItem, clearDraft, detectKind, extractUrl, loadDraft, newDraft, parseAmount, saveCapture, saveDraft } from "@/lib/capture/capture";

const U = "user-a";

describe("quick capture persistence", () => {
  it("saves immediately without classification and is idempotent on clientId", async () => {
    const d = newDraft();
    const first = await saveCapture(U, { clientId: d.clientId, content: "Call Ravi about Diwali" });
    const second = await saveCapture(U, { clientId: d.clientId, content: "Call Ravi about Diwali" });
    expect(second.id).toBe(first.id);
    expect(await getDB().inbox_items.count()).toBe(1);
    expect(first.status).toBe("unprocessed");
    expect(first.classified_as).toBeNull();
    expect(await getDB().outbox.count()).toBe(1);
  });

  it("autosaves and clears drafts locally", async () => {
    const d = { ...newDraft(), content: "half a thought" };
    await saveDraft(d);
    expect((await loadDraft())?.content).toBe("half a thought");
    await clearDraft();
    expect(await loadDraft()).toBeNull();
  });

  it("detects links and amounts", () => {
    expect(extractUrl("see https://example.com/a?b=1 later")).toBe("https://example.com/a?b=1");
    expect(detectKind("x", "https://a.b")).toBe("link");
    expect(detectKind("x", "", "image/png")).toBe("photo");
    expect(parseAmount("Chai ₹180 at Chai Point")).toBe(180);
    expect(parseAmount("Rs. 1,240.50 groceries")).toBe(1240.5);
    expect(parseAmount("no numbers")).toBeNull();
  });

  it("classifies into first-class records and links back", async () => {
    const item = await saveCapture(U, { clientId: "c1", content: "Pay gym 1500" });
    const r = await classifyInboxItem(U, item, "expense", { amount: 1500 });
    expect(r.linkedType).toBe("transactions");
    const tx = await getDB().transactions.get(r.linkedId);
    expect(tx?.amount).toBe(1500);
    const after = await getDB().inbox_items.get(item.id);
    expect(after?.status).toBe("classified");
    expect(after?.linked_id).toBe(r.linkedId);

    const item2 = await saveCapture(U, { clientId: "c2", content: "Dentist", scheduledFor: "2026-09-10T09:00:00.000Z" });
    const t = await classifyInboxItem(U, item2, "task");
    const task = await getDB().tasks.get(t.linkedId);
    expect(task?.due_on).toBe("2026-09-10");
    expect(task?.source_inbox_id).toBe(item2.id);

    const item3 = await saveCapture(U, { clientId: "c3", content: "Meal prep on Sundays" });
    const n = await classifyInboxItem(U, item3, "idea");
    expect((await getDB().notes.get(n.linkedId))?.kind).toBe("idea");
  });
});
