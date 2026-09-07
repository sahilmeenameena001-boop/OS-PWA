import type { Bill, Debt, Profile, SavingsGoal, SavingsContribution, Subscription, Transaction } from "@/lib/types";
import { budgetPeriod } from "@/lib/dates";

export interface SafeToSpendInput {
  monthlyIncome: number;
  openingBalance: number;
  protectedSavings: number;
  unpaidFixedBills: number;
  debtCommitments: number;
  expensesRecorded: number;
  remainingDays: number;
}

export interface SafeToSpendResult {
  availableForSpending: number;
  safeToSpendToday: number;
  projectedMonthEnd: number;
}

/**
 * available = income + opening − protected savings − unpaid fixed bills − debts − expenses
 * safe today = max(available, 0) / remaining days
 */
export function computeSafeToSpend(i: SafeToSpendInput): SafeToSpendResult {
  const available =
    i.monthlyIncome +
    i.openingBalance -
    i.protectedSavings -
    i.unpaidFixedBills -
    i.debtCommitments -
    i.expensesRecorded;
  const days = Math.max(1, Math.floor(i.remainingDays));
  const safe = Math.max(available, 0) / days;
  return {
    availableForSpending: round2(available),
    safeToSpendToday: round2(safe),
    projectedMonthEnd: round2(available),
  };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Posted (non-reversed) transactions only. Reversal pairs cancel out. */
export function effectiveTransactions(txs: Transaction[]): Transaction[] {
  return txs.filter((t) => t.status === "posted");
}

export function sumExpenses(txs: Transaction[], from: string, to: string): number {
  return round2(
    effectiveTransactions(txs)
      .filter((t) => t.type === "expense" && t.occurred_on >= from && t.occurred_on <= to)
      .reduce((s, t) => s + t.amount, 0),
  );
}

export function sumByType(txs: Transaction[], type: Transaction["type"], from: string, to: string): number {
  return round2(
    effectiveTransactions(txs)
      .filter((t) => t.type === type && t.occurred_on >= from && t.occurred_on <= to)
      .reduce((s, t) => s + t.amount, 0),
  );
}

export function unpaidFixedBills(bills: Bill[], from: string, to: string): number {
  return round2(
    bills
      .filter((b) => b.status === "active" && b.is_fixed && b.next_due_on >= from && b.next_due_on <= to)
      .reduce((s, b) => s + b.amount, 0),
  );
}

export function upcomingSubscriptions(subs: Subscription[], from: string, to: string): number {
  return round2(
    subs
      .filter((s) => s.status === "active" && s.next_billing_on >= from && s.next_billing_on <= to)
      .reduce((s, x) => s + x.amount, 0),
  );
}

export function debtCommitments(debts: Debt[]): number {
  return round2(debts.filter((d) => d.status === "active").reduce((s, d) => s + Math.min(d.monthly_payment, d.remaining), 0));
}

export function protectedSavingsTotal(goals: SavingsGoal[], contributions: SavingsContribution[], minimum: number): number {
  const protectedGoalIds = new Set(goals.filter((g) => g.is_protected && g.status !== "paused").map((g) => g.id));
  const saved = contributions.filter((c) => protectedGoalIds.has(c.goal_id)).reduce((s, c) => s + c.amount, 0);
  return round2(Math.max(saved, minimum));
}

export interface MoneySnapshot extends SafeToSpendResult {
  spentToday: number;
  spentThisPeriod: number;
  incomeThisPeriod: number;
  billsRemaining: number;
  subscriptionsRemaining: number;
  protectedSavings: number;
  debtCommitments: number;
  period: ReturnType<typeof budgetPeriod>;
  dailyLimit: number | null;
}

export function buildMoneySnapshot(args: {
  profile: Pick<Profile, "monthly_income" | "opening_balance" | "protected_savings_min" | "income_day" | "daily_limit">;
  transactions: Transaction[];
  bills: Bill[];
  subscriptions: Subscription[];
  debts: Debt[];
  goals: SavingsGoal[];
  contributions: SavingsContribution[];
  now?: Date;
  todayKey: string;
}): MoneySnapshot {
  const now = args.now ?? new Date();
  const period = budgetPeriod(args.profile.income_day, now);
  const spentThisPeriod = sumExpenses(args.transactions, period.start, period.end);
  const incomeThisPeriod = sumByType(args.transactions, "income", period.start, period.end);
  const billsRemaining = unpaidFixedBills(args.bills, args.todayKey, period.end);
  const subscriptionsRemaining = upcomingSubscriptions(args.subscriptions, args.todayKey, period.end);
  const protectedSavings = protectedSavingsTotal(args.goals, args.contributions, args.profile.protected_savings_min);
  const debts = debtCommitments(args.debts);
  // Recorded income in-period replaces the planned figure when it is larger (income actually arrived).
  const monthlyIncome = Math.max(args.profile.monthly_income, incomeThisPeriod);
  const core = computeSafeToSpend({
    monthlyIncome,
    openingBalance: args.profile.opening_balance,
    protectedSavings,
    unpaidFixedBills: billsRemaining + subscriptionsRemaining,
    debtCommitments: debts,
    expensesRecorded: spentThisPeriod,
    remainingDays: period.remainingDays,
  });
  const safeToday = args.profile.daily_limit != null ? Math.min(core.safeToSpendToday, args.profile.daily_limit) : core.safeToSpendToday;
  return {
    ...core,
    safeToSpendToday: round2(safeToday),
    spentToday: sumExpenses(args.transactions, args.todayKey, args.todayKey),
    spentThisPeriod,
    incomeThisPeriod,
    billsRemaining,
    subscriptionsRemaining,
    protectedSavings,
    debtCommitments: debts,
    period,
    dailyLimit: args.profile.daily_limit,
  };
}

export interface PurchaseImpact {
  safeTodayAfter: number;
  safeTodayBefore: number;
  goalDaysDelayed: number;
  suggestedWaitHours: number;
  shareOfAvailable: number;
}

/** Impact of a discretionary purchase on today's safe-to-spend and on the top savings goal. */
export function purchaseImpact(price: number, snapshot: Pick<MoneySnapshot, "availableForSpending" | "safeToSpendToday" | "period">, goal: Pick<SavingsGoal, "planned_monthly"> | null): PurchaseImpact {
  const availableAfter = snapshot.availableForSpending - price;
  const safeAfter = Math.max(availableAfter, 0) / snapshot.period.remainingDays;
  const dailySaving = goal && goal.planned_monthly > 0 ? goal.planned_monthly / 30 : 0;
  const goalDaysDelayed = dailySaving > 0 ? Math.ceil(price / dailySaving) : 0;
  const share = snapshot.availableForSpending > 0 ? price / snapshot.availableForSpending : 1;
  let suggestedWaitHours = 0;
  if (share >= 0.5) suggestedWaitHours = 72;
  else if (share >= 0.2) suggestedWaitHours = 48;
  else if (share >= 0.05) suggestedWaitHours = 24;
  return {
    safeTodayBefore: round2(snapshot.safeToSpendToday),
    safeTodayAfter: round2(safeAfter),
    goalDaysDelayed,
    suggestedWaitHours,
    shareOfAvailable: round2(share),
  };
}

export type BudgetAlertLevel = 50 | 75 | 90 | 100;
export function budgetAlertLevel(spent: number, budget: number): BudgetAlertLevel | null {
  if (budget <= 0) return null;
  const pct = (spent / budget) * 100;
  if (pct >= 100) return 100;
  if (pct >= 90) return 90;
  if (pct >= 75) return 75;
  if (pct >= 50) return 50;
  return null;
}

/** Repeated merchants (3+ times) and single expenses > 3x the median in the period. */
export function unusualExpenses(txs: Transaction[], from: string, to: string): { repeated: { merchant: string; count: number; total: number }[]; large: Transaction[] } {
  const inPeriod = effectiveTransactions(txs).filter((t) => t.type === "expense" && t.occurred_on >= from && t.occurred_on <= to);
  const byMerchant = new Map<string, { count: number; total: number }>();
  for (const t of inPeriod) {
    const key = (t.merchant ?? "").trim().toLowerCase();
    if (!key) continue;
    const cur = byMerchant.get(key) ?? { count: 0, total: 0 };
    byMerchant.set(key, { count: cur.count + 1, total: round2(cur.total + t.amount) });
  }
  const repeated = [...byMerchant.entries()]
    .filter(([, v]) => v.count >= 3)
    .map(([merchant, v]) => ({ merchant, ...v }))
    .sort((a, b) => b.total - a.total);
  const amounts = inPeriod.map((t) => t.amount).sort((a, b) => a - b);
  const median = amounts.length ? amounts[Math.floor(amounts.length / 2)] : 0;
  const large = median > 0 ? inPeriod.filter((t) => t.amount > median * 3) : [];
  return { repeated, large };
}
