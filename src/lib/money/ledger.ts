import { insert, getOne, update, listAll } from "@/lib/data/repo";
import { getDB } from "@/lib/data/db";
import { newId } from "@/lib/ids";
import { nowIso, todayKey } from "@/lib/dates";
import { advanceDue } from "@/lib/schedule/recurrence";
import type { Bill, Subscription, Transaction, TransactionType } from "@/lib/types";

export interface NewTransactionInput {
  type: TransactionType;
  amount: number;
  account_id?: string | null;
  to_account_id?: string | null;
  category_id?: string | null;
  merchant?: string | null;
  note?: string | null;
  occurred_on?: string;
  occurred_at?: string;
  receipt_attachment_id?: string | null;
  is_discretionary?: boolean;
  source?: string;
  linked_type?: string | null;
  linked_id?: string | null;
  id?: string;
}

export async function recordTransaction(userId: string, input: NewTransactionInput): Promise<Transaction> {
  if (!(input.amount > 0)) throw new Error("Amount must be greater than zero");
  const occurredAt = input.occurred_at ?? nowIso();
  return insert("transactions", userId, {
    id: input.id,
    type: input.type,
    amount: Math.round(input.amount * 100) / 100,
    account_id: input.account_id ?? null,
    to_account_id: input.to_account_id ?? null,
    category_id: input.category_id ?? null,
    merchant: input.merchant?.trim() || null,
    note: input.note?.trim() || null,
    occurred_on: input.occurred_on ?? todayKey(),
    occurred_at: occurredAt,
    receipt_attachment_id: input.receipt_attachment_id ?? null,
    status: "posted",
    reverses_id: null,
    reversed_by_id: null,
    is_discretionary: input.is_discretionary ?? true,
    source: input.source ?? "manual",
    linked_type: input.linked_type ?? null,
    linked_id: input.linked_id ?? null,
  });
}

/**
 * Financial records are never edited in place. A reversal posts a mirror entry and marks
 * the original as reversed; both keep their timestamps. An optional replacement is
 * posted as a fresh transaction linked to the original.
 */
export async function reverseTransaction(userId: string, id: string, replacement?: NewTransactionInput): Promise<{ reversal: Transaction; replacement: Transaction | null }> {
  const original = await getOne("transactions", userId, id);
  if (!original) throw new Error("Transaction not found");
  if (original.status !== "posted") throw new Error("Only posted transactions can be reversed");
  const reversalId = newId();
  const reversal = await insert("transactions", userId, {
    id: reversalId,
    type: original.type,
    amount: original.amount,
    account_id: original.account_id,
    to_account_id: original.to_account_id,
    category_id: original.category_id,
    merchant: original.merchant,
    note: `Reversal of ${original.merchant ?? original.type} (${original.occurred_on})`,
    occurred_on: todayKey(),
    occurred_at: nowIso(),
    receipt_attachment_id: null,
    status: "reversal",
    reverses_id: original.id,
    reversed_by_id: null,
    is_discretionary: original.is_discretionary,
    source: "reversal",
    linked_type: original.linked_type,
    linked_id: original.linked_id,
  });
  await update("transactions", userId, original.id, { status: "reversed", reversed_by_id: reversalId });
  let replaced: Transaction | null = null;
  if (replacement) {
    replaced = await recordTransaction(userId, { ...replacement, linked_type: "corrects", linked_id: original.id });
  }
  return { reversal, replacement: replaced };
}

export async function payBill(userId: string, bill: Bill, accountId: string | null): Promise<Transaction> {
  const tx = await recordTransaction(userId, {
    type: "expense",
    amount: bill.amount,
    account_id: accountId ?? bill.account_id,
    category_id: bill.category_id,
    merchant: bill.name,
    is_discretionary: false,
    source: "bill",
    linked_type: "bills",
    linked_id: bill.id,
  });
  const next = bill.frequency === "once" ? bill.next_due_on : advanceDue(bill.next_due_on, bill.frequency);
  await update("bills", userId, bill.id, {
    last_paid_on: todayKey(),
    next_due_on: next,
    status: bill.frequency === "once" ? "ended" : bill.status,
  });
  return tx;
}

export async function renewSubscription(userId: string, sub: Subscription, accountId: string | null): Promise<Transaction> {
  const tx = await recordTransaction(userId, {
    type: "expense",
    amount: sub.amount,
    account_id: accountId,
    category_id: sub.category_id,
    merchant: sub.name,
    is_discretionary: !sub.is_essential,
    source: "subscription",
    linked_type: "subscriptions",
    linked_id: sub.id,
  });
  await update("subscriptions", userId, sub.id, { next_billing_on: advanceDue(sub.next_billing_on, sub.billing_cycle) });
  return tx;
}

export async function contributeToGoal(userId: string, goalId: string, amount: number, accountId: string | null, note?: string): Promise<void> {
  const tx = await recordTransaction(userId, {
    type: "contribution",
    amount,
    account_id: accountId,
    merchant: "Savings",
    note: note ?? null,
    is_discretionary: false,
    source: "savings",
    linked_type: "savings_goals",
    linked_id: goalId,
  });
  await insert("savings_contributions", userId, { goal_id: goalId, amount, contributed_on: todayKey(), transaction_id: tx.id, note: note ?? null });
}

export async function repayDebt(userId: string, debtId: string, amount: number, accountId: string | null): Promise<void> {
  const debt = await getOne("debts", userId, debtId);
  if (!debt) throw new Error("Debt not found");
  await recordTransaction(userId, {
    type: "repayment",
    amount,
    account_id: accountId,
    merchant: debt.name,
    is_discretionary: false,
    source: "debt",
    linked_type: "debts",
    linked_id: debtId,
  });
  const remaining = Math.max(0, debt.remaining - amount);
  await update("debts", userId, debtId, { remaining, status: remaining === 0 ? "closed" : "active" });
}

export async function accountBalances(userId: string): Promise<Map<string, number>> {
  const [accounts, txs] = await Promise.all([listAll("accounts", userId), listAll("transactions", userId)]);
  const balances = new Map<string, number>(accounts.map((a) => [a.id, a.opening_balance]));
  for (const t of txs) {
    if (t.status !== "posted") continue;
    const sign = t.status === "posted" ? 1 : -1;
    if (t.type === "income" && t.account_id) balances.set(t.account_id, (balances.get(t.account_id) ?? 0) + sign * t.amount);
    else if (t.type === "transfer") {
      if (t.account_id) balances.set(t.account_id, (balances.get(t.account_id) ?? 0) - sign * t.amount);
      if (t.to_account_id) balances.set(t.to_account_id, (balances.get(t.to_account_id) ?? 0) + sign * t.amount);
    } else if (t.account_id) balances.set(t.account_id, (balances.get(t.account_id) ?? 0) - sign * t.amount);
  }
  return balances;
}

export function transactionsToCsv(txs: Transaction[], categories: Map<string, string>, accounts: Map<string, string>): string {
  const header = ["id", "date", "time", "type", "amount", "category", "account", "merchant", "note", "status", "reverses_id"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = txs
    .slice()
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
    .map((t) =>
      [t.id, t.occurred_on, t.occurred_at, t.type, t.amount.toFixed(2), categories.get(t.category_id ?? "") ?? "", accounts.get(t.account_id ?? "") ?? "", t.merchant, t.note, t.status, t.reverses_id]
        .map(esc)
        .join(","),
    );
  return [header.join(","), ...rows].join("\n");
}

export async function deleteAllForUser(userId: string): Promise<void> {
  const db = getDB();
  await db.transaction("rw", db.tables, async () => {
    for (const t of db.tables) {
      if (t.name === "kv") continue;
      if (t.name === "outbox") {
        await db.outbox.clear();
        continue;
      }
      await t.where("user_id").equals(userId).delete();
    }
  });
}
