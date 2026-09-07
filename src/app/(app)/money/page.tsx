"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useSession } from "@/lib/session/session-provider";
import { useRows, useRowsOr, useCurrency } from "@/lib/data/hooks";
import { useMoneySnapshot } from "@/components/money/use-money-snapshot";
import { formatMoney } from "@/lib/format";
import { todayKey, formatDateHuman, monthKey } from "@/lib/dates";
import { budgetAlertLevel, unusualExpenses } from "@/lib/money/safe-to-spend";
import { payBill, renewSubscription, repayDebt, transactionsToCsv, accountBalances } from "@/lib/money/ledger";
import { PageHeader, Panel, Stat, EmptyState, StatusPill, SkeletonRows, SegmentedControl } from "@/components/common";
import { SafeToSpendCard } from "@/components/money/safe-to-spend-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconPlus, IconDownload, IconEdit, IconWarning } from "@/components/icons";
import { useUI } from "@/store/ui";
import { AccountDialog, BillDialog, BudgetDialog, CategoryDialog, DebtDialog, IncomeTransferDialog, SubscriptionDialog, TransactionDialog } from "@/components/money/dialogs";
import { ProgressRing } from "@/components/visuals/progress-ring";
import type { Account, Bill, Budget, Debt, ExpenseCategory, Subscription, Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "overview" | "transactions" | "bills" | "budgets" | "accounts";

function MoneyInner() {
  const params = useSearchParams();
  const { userId } = useSession();
  const currency = useCurrency();
  const openExpense = useUI((s) => s.openExpense);
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "overview");
  const snap = useMoneySnapshot();
  const transactions = useRows("transactions");
  const bills = useRowsOr("bills");
  const subs = useRowsOr("subscriptions");
  const debts = useRowsOr("debts");
  const budgets = useRowsOr("budgets");
  const categories = useRowsOr("expense_categories");
  const accounts = useRowsOr("accounts");
  const [balances, setBalances] = useState<Map<string, number>>(new Map());
  const [search, setSearch] = useState("");
  const [dlg, setDlg] = useState<{ kind: "bill"; item: Bill | null } | { kind: "sub"; item: Subscription | null } | { kind: "debt"; item: Debt | null } | { kind: "account"; item: Account | null } | { kind: "category"; item: ExpenseCategory | null } | { kind: "budget"; category: ExpenseCategory; existing: Budget | null } | { kind: "income" } | { kind: "transfer" } | { kind: "tx"; item: Transaction } | null>(null);
  const today = todayKey();
  const month = monthKey();

  useEffect(() => {
    if (params.get("add") === "1") openExpense();
  }, [params, openExpense]);
  useEffect(() => {
    void accountBalances(userId).then(setBalances);
  }, [userId, transactions, accounts]);

  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const accName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  const byCategory = useMemo(() => {
    if (!snap || !transactions) return [];
    const map = new Map<string, number>();
    for (const t of transactions) if (t.status === "posted" && t.type === "expense" && t.occurred_on >= snap.period.start && t.occurred_on <= snap.period.end) map.set(t.category_id ?? "", (map.get(t.category_id ?? "") ?? 0) + t.amount);
    return [...map.entries()].map(([id, total]) => ({ id, name: catName.get(id) ?? "Uncategorised", total })).sort((a, b) => b.total - a.total);
  }, [snap, transactions, catName]);
  const maxCat = byCategory[0]?.total ?? 1;
  const unusual = useMemo(() => (snap && transactions ? unusualExpenses(transactions, snap.period.start, snap.period.end) : { repeated: [], large: [] }), [snap, transactions]);

  const filteredTx = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (transactions ?? [])
      .filter((t) => !q || `${t.merchant ?? ""} ${t.note ?? ""} ${catName.get(t.category_id ?? "") ?? ""} ${t.type}`.toLowerCase().includes(q))
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
      .slice(0, 300);
  }, [transactions, search, catName]);

  const exportCsv = () => {
    const csv = transactionsToCsv(transactions ?? [], catName, accName);
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `transactions-${today}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };


  return (
    <div className="space-y-4">
      <PageHeader
        title="Money"
        subtitle={snap ? `Budget period ${formatDateHuman(snap.period.start)} → ${formatDateHuman(snap.period.end)}` : undefined}
        actions={
          <>
            <Button size="sm" onClick={openExpense}><IconPlus size={16} /> Expense</Button>
            <Button size="sm" variant="outline" onClick={() => setDlg({ kind: "income" })}>Income</Button>
            <Button size="sm" variant="outline" onClick={() => setDlg({ kind: "transfer" })}>Transfer</Button>
            <Button size="sm" variant="ghost" onClick={exportCsv} aria-label="Export CSV"><IconDownload size={16} /> CSV</Button>
          </>
        }
      />
      <SegmentedControl value={tab} onChange={setTab} ariaLabel="Money sections" options={[{ value: "overview", label: "Overview" }, { value: "transactions", label: "Transactions" }, { value: "bills", label: "Bills & subs" }, { value: "budgets", label: "Budgets" }, { value: "accounts", label: "Accounts" }]} />

      {tab === "overview" ? (
        <div className="space-y-4">
          <SafeToSpendCard />
          {!snap ? <SkeletonRows /> : (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Stat label="Spent today" value={formatMoney(snap.spentToday, currency)} />
              <Stat label="Spent this period" value={formatMoney(snap.spentThisPeriod, currency)} hint={`of ${formatMoney(snap.spentThisPeriod + Math.max(snap.availableForSpending, 0), currency, { compact: true })} planned`} />
              <Stat label="Bills remaining" value={formatMoney(snap.billsRemaining + snap.subscriptionsRemaining, currency)} tone="amber" />
              <Stat label="Protected savings" value={formatMoney(snap.protectedSavings, currency)} tone="mint" />
              <Stat label="Available money" value={formatMoney(snap.availableForSpending, currency)} tone={snap.availableForSpending < 0 ? "coral" : "default"} hint="after savings, bills and debts" />
              <Stat label="Debt commitments" value={formatMoney(snap.debtCommitments, currency)} />
              <Stat label="Projected month-end" value={formatMoney(snap.projectedMonthEnd, currency)} tone={snap.projectedMonthEnd < 0 ? "coral" : "primary"} />
              <Stat label="Income this period" value={formatMoney(snap.incomeThisPeriod, currency)} tone="mint" />
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Category breakdown">
              {byCategory.length === 0 ? <EmptyState title="No spending yet this period" body="Log expenses as they happen and this fills in by category." action={<Button size="sm" onClick={openExpense}><IconPlus size={16} /> Add expense</Button>} /> : (
                <ul className="space-y-2">
                  {byCategory.map((c) => (
                    <li key={c.id}>
                      <div className="flex justify-between text-sm"><span>{c.name}</span><span className="tabular-nums">{formatMoney(c.total, currency)}</span></div>
                      <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${(c.total / maxCat) * 100}%` }} /></div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Worth a look">
              {unusual.repeated.length === 0 && unusual.large.length === 0 ? <p className="text-sm text-muted-foreground">No repeated or unusually large expenses this period.</p> : (
                <ul className="space-y-2 text-sm">
                  {unusual.repeated.map((r) => <li key={r.merchant} className="flex items-center gap-2"><IconWarning size={16} className="text-amber" /><span className="flex-1 capitalize">{r.merchant} · {r.count} times</span><span className="tabular-nums">{formatMoney(r.total, currency)}</span></li>)}
                  {unusual.large.map((t) => <li key={t.id} className="flex items-center gap-2"><IconWarning size={16} className="text-coral" /><span className="flex-1">{t.merchant ?? catName.get(t.category_id ?? "") ?? "Large expense"} · {formatDateHuman(t.occurred_on)}</span><span className="tabular-nums">{formatMoney(t.amount, currency)}</span></li>)}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      ) : null}

      {tab === "transactions" ? (
        <Panel title="All transactions" action={<Input aria-label="Search transactions" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-44" />}>
          {!transactions ? <SkeletonRows rows={6} /> : filteredTx.length === 0 ? <EmptyState title="No transactions" action={<Button size="sm" onClick={openExpense}>Add expense</Button>} /> : (
            <ul className="divide-y divide-border">
              {filteredTx.map((t) => (
                <li key={t.id}>
                  <button onClick={() => setDlg({ kind: "tx", item: t })} className={cn("flex w-full items-center gap-3 py-2 text-left hover:bg-muted/50", t.status !== "posted" && "opacity-50")}>
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold", t.type === "income" ? "bg-mint/15 text-mint" : t.type === "expense" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{t.type === "income" ? "+" : t.type === "expense" ? "−" : "↔"}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{t.merchant ?? catName.get(t.category_id ?? "") ?? t.type}</span><span className="block text-xs text-muted-foreground">{formatDateHuman(t.occurred_on)} · {catName.get(t.category_id ?? "") ?? t.type} · {accName.get(t.account_id ?? "") ?? ""}{t.status !== "posted" ? ` · ${t.status}` : ""}</span></span>
                    <span className={cn("text-sm font-semibold tabular-nums", t.type === "income" && "text-mint", t.status !== "posted" && "line-through")}>{formatMoney(t.amount, currency)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}

      {tab === "bills" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="Recurring bills" action={<Button size="sm" variant="ghost" onClick={() => setDlg({ kind: "bill", item: null })}><IconPlus size={16} /> Bill</Button>}>
            {bills.length === 0 ? <EmptyState title="No bills yet" body="Rent, utilities, EMIs… anything with a due date. Fixed bills are reserved from safe-to-spend until paid." action={<Button size="sm" onClick={() => setDlg({ kind: "bill", item: null })}><IconPlus size={16} /> Add a bill</Button>} /> : (
              <ul className="space-y-1">
                {bills.filter((b) => b.status !== "ended").sort((a, b) => a.next_due_on.localeCompare(b.next_due_on)).map((b) => (
                  <li key={b.id} className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-muted/50">
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{b.name}</p><p className="text-xs text-muted-foreground">{formatDateHuman(b.next_due_on)} · {b.frequency}{b.is_fixed ? " · fixed" : ""}{b.last_paid_on ? ` · paid ${formatDateHuman(b.last_paid_on)}` : ""}</p></div>
                    {b.next_due_on < today ? <StatusPill tone="coral">Overdue</StatusPill> : b.next_due_on === today ? <StatusPill tone="amber">Today</StatusPill> : null}
                    <span className="text-sm font-semibold tabular-nums">{formatMoney(b.amount, currency)}</span>
                    <Button size="sm" onClick={async () => { await payBill(userId, b, b.account_id); toast.success(`${b.name} paid`); }}>Paid</Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Edit ${b.name}`} onClick={() => setDlg({ kind: "bill", item: b })}><IconEdit size={14} /></Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Subscriptions" action={<Button size="sm" variant="ghost" onClick={() => setDlg({ kind: "sub", item: null })}><IconPlus size={16} /> Sub</Button>}>
            {subs.length === 0 ? <EmptyState title="No subscriptions" body="Netflix, Spotify, cloud storage… track renewals so they never surprise you." action={<Button size="sm" onClick={() => setDlg({ kind: "sub", item: null })}><IconPlus size={16} /> Add a subscription</Button>} /> : (
              <ul className="space-y-1">
                {subs.sort((a, b) => a.next_billing_on.localeCompare(b.next_billing_on)).map((s) => (
                  <li key={s.id} className={cn("flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-muted/50", s.status !== "active" && "opacity-60")}>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.status === "active" ? `Renews ${formatDateHuman(s.next_billing_on)}` : s.status} · {s.billing_cycle}{s.is_essential ? " · essential" : ""}</p></div>
                    <span className="text-sm font-semibold tabular-nums">{formatMoney(s.amount, currency)}</span>
                    {s.status === "active" ? <Button size="sm" variant="outline" onClick={async () => { await renewSubscription(userId, s, accounts[0]?.id ?? null); toast.success(`${s.name} charged`); }}>Charged</Button> : null}
                    <Button size="icon-sm" variant="ghost" aria-label={`Edit ${s.name}`} onClick={() => setDlg({ kind: "sub", item: s })}><IconEdit size={14} /></Button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted-foreground">Monthly total: {formatMoney(subs.filter((s) => s.status === "active").reduce((sum, s) => sum + (s.billing_cycle === "yearly" ? s.amount / 12 : s.billing_cycle === "weekly" ? s.amount * 4.33 : s.amount), 0), currency)}</p>
          </Panel>
          <Panel title="Debts and repayments" action={<Button size="sm" variant="ghost" onClick={() => setDlg({ kind: "debt", item: null })}><IconPlus size={16} /> Debt</Button>} className="md:col-span-2">
            {debts.length === 0 ? <EmptyState title="No debts recorded" body="Add an EMI or loan and its monthly payment is set aside automatically." action={<Button size="sm" variant="outline" onClick={() => setDlg({ kind: "debt", item: null })}><IconPlus size={16} /> Add a debt</Button>} /> : (
              <ul className="grid gap-2 md:grid-cols-2">
                {debts.map((d) => {
                  const paid = d.principal > 0 ? 1 - d.remaining / d.principal : 0;
                  return (
                    <li key={d.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                      <ProgressRing value={paid} size={56} stroke={6} tone="mint" label={`${d.name} repaid`} />
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{d.name}{d.lender ? ` · ${d.lender}` : ""}</p><p className="text-xs text-muted-foreground">{formatMoney(d.remaining, currency)} left · {formatMoney(d.monthly_payment, currency)}/month{d.due_day ? ` · due ${d.due_day}th` : ""}</p></div>
                      {d.status === "active" ? <Button size="sm" onClick={async () => { await repayDebt(userId, d.id, Math.min(d.monthly_payment, d.remaining), accounts[0]?.id ?? null); toast.success("Repayment recorded"); }}>Pay EMI</Button> : <StatusPill tone="mint">Closed</StatusPill>}
                      <Button size="icon-sm" variant="ghost" aria-label={`Edit ${d.name}`} onClick={() => setDlg({ kind: "debt", item: d })}><IconEdit size={14} /></Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      ) : null}

      {tab === "budgets" ? (
        <Panel title="Monthly budgets by category" action={<Button size="sm" variant="ghost" onClick={() => setDlg({ kind: "category", item: null })}><IconPlus size={16} /> Category</Button>}>
          <ul className="grid gap-2 md:grid-cols-2">
            {categories.filter((c) => !c.is_archived).sort((a, b) => a.sort_order - b.sort_order).map((c) => {
              const b = budgets.find((x) => x.category_id === c.id && x.month === month) ?? null;
              const spent = (transactions ?? []).filter((t) => t.status === "posted" && t.type === "expense" && t.category_id === c.id && t.occurred_on >= month && t.occurred_on <= today).reduce((s, t) => s + t.amount, 0);
              const level = b ? budgetAlertLevel(spent, b.amount) : null;
              const pct = b && b.amount > 0 ? spent / b.amount : 0;
              return (
                <li key={c.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <ProgressRing value={pct} size={52} stroke={6} tone={level === 100 ? "coral" : level && level >= 75 ? "amber" : "primary"} label={`${c.name} budget used`} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium"><span className="truncate">{c.name}</span>{c.is_essential ? <StatusPill tone="muted">essential</StatusPill> : null}{level ? <StatusPill tone={level === 100 ? "coral" : "amber"}>{level}%</StatusPill> : null}</p>
                    <p className="text-xs text-muted-foreground">{formatMoney(spent, currency)}{b ? ` of ${formatMoney(b.amount, currency)}` : " · no budget"}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setDlg({ kind: "budget", category: c, existing: b })}>{b ? "Edit" : "Set"}</Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Edit category ${c.name}`} onClick={() => setDlg({ kind: "category", item: c })}><IconEdit size={14} /></Button>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}

      {tab === "accounts" ? (
        <Panel title="Accounts" action={<Button size="sm" variant="ghost" onClick={() => setDlg({ kind: "account", item: null })}><IconPlus size={16} /> Account</Button>}>
          <ul className="grid gap-2 md:grid-cols-2">
            {accounts.sort((a, b) => a.sort_order - b.sort_order).map((a) => (
              <li key={a.id} className={cn("flex items-center gap-3 rounded-xl border border-border p-3", a.is_archived && "opacity-50")}>
                <span className="grid size-10 place-items-center rounded-xl bg-muted text-xs font-semibold uppercase">{a.type}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{a.name}</p><p className="text-xs text-muted-foreground">{a.is_archived ? "Archived" : "Balance"}</p></div>
                <span className={cn("text-sm font-semibold tabular-nums", (balances.get(a.id) ?? 0) < 0 && "text-coral")}>{formatMoney(balances.get(a.id) ?? a.opening_balance, currency)}</span>
                <Button size="icon-sm" variant="ghost" aria-label={`Edit ${a.name}`} onClick={() => setDlg({ kind: "account", item: a })}><IconEdit size={14} /></Button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">Card balances go negative as you spend; they are what you owe.</p>
        </Panel>
      ) : null}

      <BillDialog open={dlg?.kind === "bill"} onOpenChange={(o) => !o && setDlg(null)} bill={dlg?.kind === "bill" ? dlg.item : null} />
      <SubscriptionDialog open={dlg?.kind === "sub"} onOpenChange={(o) => !o && setDlg(null)} sub={dlg?.kind === "sub" ? dlg.item : null} />
      <DebtDialog open={dlg?.kind === "debt"} onOpenChange={(o) => !o && setDlg(null)} debt={dlg?.kind === "debt" ? dlg.item : null} />
      <AccountDialog open={dlg?.kind === "account"} onOpenChange={(o) => !o && setDlg(null)} account={dlg?.kind === "account" ? dlg.item : null} />
      <CategoryDialog open={dlg?.kind === "category"} onOpenChange={(o) => !o && setDlg(null)} category={dlg?.kind === "category" ? dlg.item : null} />
      <BudgetDialog open={dlg?.kind === "budget"} onOpenChange={(o) => !o && setDlg(null)} category={dlg?.kind === "budget" ? dlg.category : null} existing={dlg?.kind === "budget" ? dlg.existing : null} />
      <IncomeTransferDialog open={dlg?.kind === "income" || dlg?.kind === "transfer"} onOpenChange={(o) => !o && setDlg(null)} type={dlg?.kind === "transfer" ? "transfer" : "income"} />
      <TransactionDialog open={dlg?.kind === "tx"} onOpenChange={(o) => !o && setDlg(null)} tx={dlg?.kind === "tx" ? dlg.item : null} />
    </div>
  );
}

export default function MoneyPage() {
  return <Suspense fallback={<SkeletonRows rows={5} />}><MoneyInner /></Suspense>;
}
