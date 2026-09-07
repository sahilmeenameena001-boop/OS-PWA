import { describe, expect, it } from "vitest";
import { getDB } from "@/lib/data/db";
import { insert } from "@/lib/data/repo";
import { accountBalances, contributeToGoal, payBill, recordTransaction, reverseTransaction } from "@/lib/money/ledger";
import { sumExpenses, protectedSavingsTotal } from "@/lib/money/safe-to-spend";
import { todayKey } from "@/lib/dates";

const U = "user-a";

describe("financial edit/reversal behaviour", () => {
  it("reversal keeps the original with its timestamp and nets to zero", async () => {
    const orig = await recordTransaction(U, { type: "expense", amount: 250, merchant: "Cafe", occurred_on: "2026-09-01" });
    const { reversal } = await reverseTransaction(U, orig.id);
    const db = getDB();
    const stored = await db.transactions.get(orig.id);
    expect(stored?.status).toBe("reversed");
    expect(stored?.amount).toBe(250);
    expect(stored?.occurred_on).toBe("2026-09-01");
    expect(stored?.reversed_by_id).toBe(reversal.id);
    expect(reversal.status).toBe("reversal");
    expect(reversal.reverses_id).toBe(orig.id);
    const all = await db.transactions.toArray();
    expect(sumExpenses(all, "2026-01-01", "2026-12-31")).toBe(0);
    await expect(reverseTransaction(U, orig.id)).rejects.toThrow(/Only posted/);
  });

  it("correction posts a replacement linked to the original", async () => {
    const orig = await recordTransaction(U, { type: "expense", amount: 100, occurred_on: "2026-09-02" });
    const { replacement } = await reverseTransaction(U, orig.id, { type: "expense", amount: 120, occurred_on: "2026-09-02" });
    expect(replacement?.amount).toBe(120);
    expect(replacement?.linked_id).toBe(orig.id);
    const all = await getDB().transactions.toArray();
    expect(sumExpenses(all, "2026-09-01", "2026-09-30")).toBe(120);
    const audits = await getDB().audit_events.where("entity_id").equals(orig.id).toArray();
    expect(audits.map((a) => a.action).sort()).toEqual(["create", "update"]);
  });

  it("rejects zero or negative amounts", async () => {
    await expect(recordTransaction(U, { type: "expense", amount: 0 })).rejects.toThrow();
    await expect(recordTransaction(U, { type: "expense", amount: -5 })).rejects.toThrow();
  });

  it("paying a bill posts an expense and advances the due date", async () => {
    const bill = await insert("bills", U, { name: "Rent", amount: 1000, frequency: "monthly", next_due_on: "2026-09-05", category_id: null, account_id: null, is_fixed: true, last_paid_on: null, status: "active" });
    await payBill(U, bill, null);
    const updated = await getDB().bills.get(bill.id);
    expect(updated?.next_due_on).toBe("2026-10-05");
    expect(updated?.last_paid_on).toBe(todayKey());
    const tx = await getDB().transactions.where("linked_id").equals(bill.id).first();
    expect(tx?.amount).toBe(1000);
    expect(tx?.is_discretionary).toBe(false);
  });

  it("account balances follow transfers and reversals", async () => {
    const a = await insert("accounts", U, { name: "A", type: "bank", opening_balance: 1000, currency: "INR", is_archived: false, sort_order: 0 });
    const b = await insert("accounts", U, { name: "B", type: "cash", opening_balance: 0, currency: "INR", is_archived: false, sort_order: 1 });
    await recordTransaction(U, { type: "transfer", amount: 300, account_id: a.id, to_account_id: b.id });
    const spend = await recordTransaction(U, { type: "expense", amount: 50, account_id: b.id });
    let bal = await accountBalances(U);
    expect(bal.get(a.id)).toBe(700);
    expect(bal.get(b.id)).toBe(250);
    await reverseTransaction(U, spend.id);
    bal = await accountBalances(U);
    expect(bal.get(b.id)).toBe(300);
  });

  it("protected savings are never counted as spendable", async () => {
    const goal = await insert("savings_goals", U, { name: "Emergency", target_amount: 10000, deadline: null, is_protected: true, is_emergency_fund: true, color: "mint", status: "active", planned_monthly: 1000 });
    const open = await insert("savings_goals", U, { name: "Trip", target_amount: 5000, deadline: null, is_protected: false, is_emergency_fund: false, color: "amber", status: "active", planned_monthly: 500 });
    await contributeToGoal(U, goal.id, 4000, null);
    await contributeToGoal(U, open.id, 1000, null);
    const goals = await getDB().savings_goals.toArray();
    const contribs = await getDB().savings_contributions.toArray();
    expect(protectedSavingsTotal(goals, contribs, 0)).toBe(4000);
    expect(protectedSavingsTotal(goals, contribs, 6000)).toBe(6000);
    const txs = await getDB().transactions.toArray();
    expect(txs.filter((t) => t.type === "contribution")).toHaveLength(2);
    expect(sumExpenses(txs, "2000-01-01", "2100-01-01")).toBe(0);
  });
});
