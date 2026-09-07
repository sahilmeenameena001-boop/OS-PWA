import { describe, expect, it } from "vitest";
import { budgetAlertLevel, buildMoneySnapshot, computeSafeToSpend, purchaseImpact, unusualExpenses } from "@/lib/money/safe-to-spend";
import type { Transaction } from "@/lib/types";

const tx = (over: Partial<Transaction>): Transaction => ({ id: over.id ?? Math.random().toString(), user_id: "u", created_at: "", updated_at: "", type: "expense", amount: 0, account_id: null, to_account_id: null, category_id: null, merchant: null, note: null, occurred_on: "2026-09-10", occurred_at: "2026-09-10T10:00:00Z", receipt_attachment_id: null, status: "posted", reverses_id: null, reversed_by_id: null, is_discretionary: true, source: "manual", linked_type: null, linked_id: null, ...over });

describe("computeSafeToSpend", () => {
  it("applies the documented formula", () => {
    const r = computeSafeToSpend({ monthlyIncome: 85000, openingBalance: 12000, protectedSavings: 15000, unpaidFixedBills: 20000, debtCommitments: 6000, expensesRecorded: 16000, remainingDays: 20 });
    expect(r.availableForSpending).toBe(40000);
    expect(r.safeToSpendToday).toBe(2000);
  });
  it("never goes below zero per day and treats 0 remaining days as 1", () => {
    const r = computeSafeToSpend({ monthlyIncome: 1000, openingBalance: 0, protectedSavings: 5000, unpaidFixedBills: 0, debtCommitments: 0, expensesRecorded: 0, remainingDays: 0 });
    expect(r.availableForSpending).toBe(-4000);
    expect(r.safeToSpendToday).toBe(0);
  });
});

describe("buildMoneySnapshot", () => {
  const profile = { monthly_income: 60000, opening_balance: 0, protected_savings_min: 10000, income_day: 1, daily_limit: null };
  it("ignores reversed transactions and counts only in-period expenses", () => {
    const now = new Date(2026, 8, 15);
    const snap = buildMoneySnapshot({
      profile,
      transactions: [tx({ amount: 1000, occurred_on: "2026-09-02" }), tx({ amount: 500, occurred_on: "2026-09-03", status: "reversed" }), tx({ amount: 500, occurred_on: "2026-09-03", status: "reversal" }), tx({ amount: 999, occurred_on: "2026-08-20" })],
      bills: [], subscriptions: [], debts: [], goals: [], contributions: [], now, todayKey: "2026-09-15",
    });
    expect(snap.spentThisPeriod).toBe(1000);
    expect(snap.protectedSavings).toBe(10000);
    expect(snap.availableForSpending).toBe(49000);
    expect(snap.period.remainingDays).toBe(16);
    expect(snap.safeToSpendToday).toBe(3062.5);
  });
  it("caps safe-to-spend at the daily limit", () => {
    const snap = buildMoneySnapshot({ profile: { ...profile, daily_limit: 500 }, transactions: [], bills: [], subscriptions: [], debts: [], goals: [], contributions: [], now: new Date(2026, 8, 15), todayKey: "2026-09-15" });
    expect(snap.safeToSpendToday).toBe(500);
  });
});

describe("purchaseImpact", () => {
  it("suggests longer waits for larger shares and computes goal delay", () => {
    const snap = { availableForSpending: 10000, safeToSpendToday: 500, period: { start: "", end: "", remainingDays: 20, totalDays: 30 } };
    const small = purchaseImpact(300, snap, { planned_monthly: 3000 });
    expect(small.suggestedWaitHours).toBe(0);
    expect(small.goalDaysDelayed).toBe(3);
    const big = purchaseImpact(6000, snap, { planned_monthly: 3000 });
    expect(big.suggestedWaitHours).toBe(72);
    expect(big.safeTodayAfter).toBe(200);
  });
});

describe("budgetAlertLevel", () => {
  it("returns thresholds at 50/75/90/100", () => {
    expect(budgetAlertLevel(49, 100)).toBeNull();
    expect(budgetAlertLevel(50, 100)).toBe(50);
    expect(budgetAlertLevel(80, 100)).toBe(75);
    expect(budgetAlertLevel(95, 100)).toBe(90);
    expect(budgetAlertLevel(120, 100)).toBe(100);
    expect(budgetAlertLevel(10, 0)).toBeNull();
  });
});

describe("unusualExpenses", () => {
  it("flags repeated merchants and outliers", () => {
    const list = [tx({ merchant: "Chai", amount: 100 }), tx({ merchant: "chai ", amount: 100 }), tx({ merchant: "CHAI", amount: 100 }), tx({ merchant: "Laptop", amount: 5000 })];
    const r = unusualExpenses(list, "2026-09-01", "2026-09-30");
    expect(r.repeated[0]).toEqual({ merchant: "chai", count: 3, total: 300 });
    expect(r.large.map((t) => t.merchant)).toEqual(["Laptop"]);
  });
});
