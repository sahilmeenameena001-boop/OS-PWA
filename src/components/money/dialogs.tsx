"use client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/lib/session/session-provider";
import { useRowsOr, useCurrency } from "@/lib/data/hooks";
import { insert, update, remove } from "@/lib/data/repo";
import { recordTransaction, reverseTransaction } from "@/lib/money/ledger";
import { todayKey, monthKey } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import type { Account, Bill, Budget, Debt, ExpenseCategory, Subscription, Transaction } from "@/lib/types";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, ConfirmDialog } from "@/components/common";

function Select({ id, value, onChange, children }: { id: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return <select id={id} className="tap w-full rounded-lg border border-input bg-background px-3 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>{children}</select>;
}

export function BillDialog({ open, onOpenChange, bill }: { open: boolean; onOpenChange: (o: boolean) => void; bill: Bill | null }) {
  const { userId } = useSession();
  const categories = useRowsOr("expense_categories");
  const accounts = useRowsOr("accounts");
  const [f, setF] = useState({ name: "", amount: "", frequency: "monthly" as Bill["frequency"], next_due_on: todayKey(), category_id: "", account_id: "", is_fixed: true });
  const [del, setDel] = useState(false);
  useEffect(() => { if (open) setF({ name: bill?.name ?? "", amount: bill ? String(bill.amount) : "", frequency: bill?.frequency ?? "monthly", next_due_on: bill?.next_due_on ?? todayKey(), category_id: bill?.category_id ?? "", account_id: bill?.account_id ?? "", is_fixed: bill?.is_fixed ?? true }); }, [open, bill]);
  const save = async () => {
    const data = { name: f.name.trim(), amount: Number(f.amount), frequency: f.frequency, next_due_on: f.next_due_on, category_id: f.category_id || null, account_id: f.account_id || null, is_fixed: f.is_fixed };
    if (bill) await update("bills", userId, bill.id, data); else await insert("bills", userId, { ...data, last_paid_on: null, status: "active" });
    toast.success("Bill saved"); onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-3">
        <DialogHeader><DialogTitle>{bill ? "Edit bill" : "New recurring bill"}</DialogTitle><DialogDescription>Fixed bills are reserved from safe-to-spend until paid.</DialogDescription></DialogHeader>
        <Field label="Name" htmlFor="bill-name"><Input id="bill-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount" htmlFor="bill-amount"><Input id="bill-amount" type="number" inputMode="decimal" min={0} step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></Field>
          <Field label="Repeats" htmlFor="bill-freq"><Select id="bill-freq" value={f.frequency} onChange={(v) => setF({ ...f, frequency: v as Bill["frequency"] })}><option value="monthly">Monthly</option><option value="weekly">Weekly</option><option value="yearly">Yearly</option><option value="once">Once</option></Select></Field>
          <Field label="Next due" htmlFor="bill-due"><Input id="bill-due" type="date" value={f.next_due_on} onChange={(e) => setF({ ...f, next_due_on: e.target.value })} required /></Field>
          <Field label="Category" htmlFor="bill-cat"><Select id="bill-cat" value={f.category_id} onChange={(v) => setF({ ...f, category_id: v })}><option value="">None</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <Field label="Pay from" htmlFor="bill-acc"><Select id="bill-acc" value={f.account_id} onChange={(v) => setF({ ...f, account_id: v })}><option value="">Any</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={f.is_fixed} onChange={(e) => setF({ ...f, is_fixed: e.target.checked })} /> Fixed amount (reserve it before spending)</label>
        <DialogFooter className="sm:justify-between">{bill ? <Button type="button" variant="destructive" onClick={() => setDel(true)}>Delete</Button> : <span />}<div className="flex gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={!f.name.trim() || !(Number(f.amount) >= 0)}>Save</Button></div></DialogFooter>
      </form>
      {bill ? <ConfirmDialog open={del} onOpenChange={setDel} title="Delete this bill?" confirmLabel="Delete" destructive onConfirm={async () => { await remove("bills", userId, bill.id); onOpenChange(false); }} /> : null}
    </DialogContent></Dialog>
  );
}

export function SubscriptionDialog({ open, onOpenChange, sub }: { open: boolean; onOpenChange: (o: boolean) => void; sub: Subscription | null }) {
  const { userId } = useSession();
  const categories = useRowsOr("expense_categories");
  const [f, setF] = useState({ name: "", amount: "", billing_cycle: "monthly" as Subscription["billing_cycle"], next_billing_on: todayKey(), category_id: "", is_essential: false, status: "active" as Subscription["status"] });
  const [del, setDel] = useState(false);
  useEffect(() => { if (open) setF({ name: sub?.name ?? "", amount: sub ? String(sub.amount) : "", billing_cycle: sub?.billing_cycle ?? "monthly", next_billing_on: sub?.next_billing_on ?? todayKey(), category_id: sub?.category_id ?? "", is_essential: sub?.is_essential ?? false, status: sub?.status ?? "active" }); }, [open, sub]);
  const save = async () => {
    const data = { name: f.name.trim(), amount: Number(f.amount), billing_cycle: f.billing_cycle, next_billing_on: f.next_billing_on, category_id: f.category_id || null, is_essential: f.is_essential, status: f.status };
    if (sub) await update("subscriptions", userId, sub.id, data); else await insert("subscriptions", userId, { ...data, started_on: todayKey() });
    toast.success("Subscription saved"); onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-3">
        <DialogHeader><DialogTitle>{sub ? "Edit subscription" : "New subscription"}</DialogTitle><DialogDescription>Non-essential subscriptions show up in your cooling-off review.</DialogDescription></DialogHeader>
        <Field label="Name" htmlFor="sub-name"><Input id="sub-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount" htmlFor="sub-amount"><Input id="sub-amount" type="number" inputMode="decimal" min={0} step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></Field>
          <Field label="Cycle" htmlFor="sub-cycle"><Select id="sub-cycle" value={f.billing_cycle} onChange={(v) => setF({ ...f, billing_cycle: v as Subscription["billing_cycle"] })}><option value="monthly">Monthly</option><option value="weekly">Weekly</option><option value="yearly">Yearly</option></Select></Field>
          <Field label="Next billing" htmlFor="sub-next"><Input id="sub-next" type="date" value={f.next_billing_on} onChange={(e) => setF({ ...f, next_billing_on: e.target.value })} required /></Field>
          <Field label="Category" htmlFor="sub-cat"><Select id="sub-cat" value={f.category_id} onChange={(v) => setF({ ...f, category_id: v })}><option value="">None</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <Field label="Status" htmlFor="sub-status"><Select id="sub-status" value={f.status} onChange={(v) => setF({ ...f, status: v as Subscription["status"] })}><option value="active">Active</option><option value="paused">Paused</option><option value="cancelled">Cancelled</option></Select></Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={f.is_essential} onChange={(e) => setF({ ...f, is_essential: e.target.checked })} /> Essential</label>
        <DialogFooter className="sm:justify-between">{sub ? <Button type="button" variant="destructive" onClick={() => setDel(true)}>Delete</Button> : <span />}<div className="flex gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={!f.name.trim()}>Save</Button></div></DialogFooter>
      </form>
      {sub ? <ConfirmDialog open={del} onOpenChange={setDel} title="Delete this subscription?" confirmLabel="Delete" destructive onConfirm={async () => { await remove("subscriptions", userId, sub.id); onOpenChange(false); }} /> : null}
    </DialogContent></Dialog>
  );
}

export function BudgetDialog({ open, onOpenChange, category, existing }: { open: boolean; onOpenChange: (o: boolean) => void; category: ExpenseCategory | null; existing: Budget | null }) {
  const { userId } = useSession();
  const [amount, setAmount] = useState("");
  useEffect(() => { if (open) setAmount(existing ? String(existing.amount) : ""); }, [open, existing]);
  const save = async () => {
    if (!category) return;
    const v = Number(amount);
    if (existing) await update("budgets", userId, existing.id, { amount: v }); else await insert("budgets", userId, { category_id: category.id, month: monthKey(), amount: v });
    toast.success("Budget saved"); onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-sm">
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-3">
        <DialogHeader><DialogTitle>Budget · {category?.name}</DialogTitle><DialogDescription>For this month. Alerts at 50, 75, 90 and 100%.</DialogDescription></DialogHeader>
        <Field label="Monthly amount" htmlFor="budget-amount"><Input id="budget-amount" type="number" inputMode="decimal" min={0} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus /></Field>
        <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={!(Number(amount) >= 0)}>Save</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  );
}

export function DebtDialog({ open, onOpenChange, debt }: { open: boolean; onOpenChange: (o: boolean) => void; debt: Debt | null }) {
  const { userId } = useSession();
  const [f, setF] = useState({ name: "", lender: "", principal: "", remaining: "", monthly_payment: "", due_day: "" });
  const [del, setDel] = useState(false);
  useEffect(() => { if (open) setF({ name: debt?.name ?? "", lender: debt?.lender ?? "", principal: debt ? String(debt.principal) : "", remaining: debt ? String(debt.remaining) : "", monthly_payment: debt ? String(debt.monthly_payment) : "", due_day: debt?.due_day ? String(debt.due_day) : "" }); }, [open, debt]);
  const save = async () => {
    const data = { name: f.name.trim(), lender: f.lender.trim() || null, principal: Number(f.principal) || 0, remaining: Number(f.remaining) || 0, monthly_payment: Number(f.monthly_payment) || 0, due_day: f.due_day ? Number(f.due_day) : null };
    if (debt) await update("debts", userId, debt.id, data); else await insert("debts", userId, { ...data, status: "active" });
    toast.success("Debt saved"); onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-3">
        <DialogHeader><DialogTitle>{debt ? "Edit debt" : "New debt or EMI"}</DialogTitle><DialogDescription>Monthly payments are reserved from safe-to-spend.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" htmlFor="debt-name" className="col-span-2"><Input id="debt-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required autoFocus /></Field>
          <Field label="Lender" htmlFor="debt-lender"><Input id="debt-lender" value={f.lender} onChange={(e) => setF({ ...f, lender: e.target.value })} /></Field>
          <Field label="Due day" htmlFor="debt-day"><Input id="debt-day" type="number" min={1} max={31} value={f.due_day} onChange={(e) => setF({ ...f, due_day: e.target.value })} /></Field>
          <Field label="Principal" htmlFor="debt-principal"><Input id="debt-principal" type="number" min={0} step="0.01" value={f.principal} onChange={(e) => setF({ ...f, principal: e.target.value })} /></Field>
          <Field label="Remaining" htmlFor="debt-remaining"><Input id="debt-remaining" type="number" min={0} step="0.01" value={f.remaining} onChange={(e) => setF({ ...f, remaining: e.target.value })} required /></Field>
          <Field label="Monthly payment" htmlFor="debt-monthly" className="col-span-2"><Input id="debt-monthly" type="number" min={0} step="0.01" value={f.monthly_payment} onChange={(e) => setF({ ...f, monthly_payment: e.target.value })} required /></Field>
        </div>
        <DialogFooter className="sm:justify-between">{debt ? <Button type="button" variant="destructive" onClick={() => setDel(true)}>Delete</Button> : <span />}<div className="flex gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={!f.name.trim()}>Save</Button></div></DialogFooter>
      </form>
      {debt ? <ConfirmDialog open={del} onOpenChange={setDel} title="Delete this debt?" confirmLabel="Delete" destructive onConfirm={async () => { await remove("debts", userId, debt.id); onOpenChange(false); }} /> : null}
    </DialogContent></Dialog>
  );
}

export function AccountDialog({ open, onOpenChange, account }: { open: boolean; onOpenChange: (o: boolean) => void; account: Account | null }) {
  const { userId } = useSession();
  const [f, setF] = useState({ name: "", type: "bank" as Account["type"], opening_balance: "" });
  useEffect(() => { if (open) setF({ name: account?.name ?? "", type: account?.type ?? "bank", opening_balance: account ? String(account.opening_balance) : "" }); }, [open, account]);
  const save = async () => {
    const data = { name: f.name.trim(), type: f.type, opening_balance: Number(f.opening_balance) || 0 };
    if (account) await update("accounts", userId, account.id, data); else await insert("accounts", userId, { ...data, currency: "INR", is_archived: false, sort_order: 99 });
    toast.success("Account saved"); onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-sm">
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-3">
        <DialogHeader><DialogTitle>{account ? "Edit account" : "New account"}</DialogTitle><DialogDescription>Cash, bank, card or UPI.</DialogDescription></DialogHeader>
        <Field label="Name" htmlFor="acc-name"><Input id="acc-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required autoFocus /></Field>
        <Field label="Type" htmlFor="acc-type"><Select id="acc-type" value={f.type} onChange={(v) => setF({ ...f, type: v as Account["type"] })}><option value="cash">Cash</option><option value="bank">Bank</option><option value="card">Card</option><option value="upi">UPI</option></Select></Field>
        <Field label="Current balance" htmlFor="acc-balance" hint="Used as the starting point for this account."><Input id="acc-balance" type="number" step="0.01" value={f.opening_balance} onChange={(e) => setF({ ...f, opening_balance: e.target.value })} /></Field>
        <DialogFooter className="sm:justify-between">{account ? <Button type="button" variant="outline" onClick={async () => { await update("accounts", userId, account.id, { is_archived: !account.is_archived }); onOpenChange(false); }}>{account.is_archived ? "Unarchive" : "Archive"}</Button> : <span />}<div className="flex gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={!f.name.trim()}>Save</Button></div></DialogFooter>
      </form>
    </DialogContent></Dialog>
  );
}

export function CategoryDialog({ open, onOpenChange, category }: { open: boolean; onOpenChange: (o: boolean) => void; category: ExpenseCategory | null }) {
  const { userId } = useSession();
  const [f, setF] = useState({ name: "", is_essential: false, color: "blue" });
  useEffect(() => { if (open) setF({ name: category?.name ?? "", is_essential: category?.is_essential ?? false, color: category?.color ?? "blue" }); }, [open, category]);
  const save = async () => {
    const data = { name: f.name.trim(), is_essential: f.is_essential, color: f.color };
    if (category) await update("expense_categories", userId, category.id, data); else await insert("expense_categories", userId, { ...data, icon: "tag", sort_order: 99, is_archived: false });
    toast.success("Category saved"); onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-sm">
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-3">
        <DialogHeader><DialogTitle>{category ? "Edit category" : "New category"}</DialogTitle><DialogDescription>Essential categories are excluded from cooling-off suggestions.</DialogDescription></DialogHeader>
        <Field label="Name" htmlFor="cat-name"><Input id="cat-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required autoFocus /></Field>
        <Field label="Colour" htmlFor="cat-color"><Select id="cat-color" value={f.color} onChange={(v) => setF({ ...f, color: v })}><option value="blue">Blue</option><option value="mint">Mint</option><option value="amber">Amber</option><option value="coral">Coral</option><option value="violet">Violet</option><option value="pink">Pink</option></Select></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={f.is_essential} onChange={(e) => setF({ ...f, is_essential: e.target.checked })} /> Essential spending</label>
        <DialogFooter className="sm:justify-between">{category ? <Button type="button" variant="outline" onClick={async () => { await update("expense_categories", userId, category.id, { is_archived: !category.is_archived }); onOpenChange(false); }}>{category.is_archived ? "Unarchive" : "Archive"}</Button> : <span />}<div className="flex gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={!f.name.trim()}>Save</Button></div></DialogFooter>
      </form>
    </DialogContent></Dialog>
  );
}

/** Income or transfer entry. Expenses use the QuickExpense dialog. */
export function IncomeTransferDialog({ open, onOpenChange, type }: { open: boolean; onOpenChange: (o: boolean) => void; type: "income" | "transfer" }) {
  const { userId } = useSession();
  const accountRows = useRowsOr("accounts");
  const accounts = useMemo(() => accountRows.filter((a) => !a.is_archived), [accountRows]);
  const currency = useCurrency();
  const [f, setF] = useState({ amount: "", account_id: "", to_account_id: "", merchant: "", note: "", occurred_on: todayKey() });
  // Reset only when the dialog opens; a fresh array dependency here would wipe input on every keystroke.
  useEffect(() => {
    if (open) setF({ amount: "", account_id: accounts[0]?.id ?? "", to_account_id: accounts[1]?.id ?? "", merchant: type === "income" ? "Salary" : "", note: "", occurred_on: todayKey() });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: reset on open/type only
  }, [open, type]);
  const save = async () => {
    await recordTransaction(userId, { type, amount: Number(f.amount), account_id: f.account_id || null, to_account_id: type === "transfer" ? f.to_account_id || null : null, merchant: f.merchant || null, note: f.note || null, occurred_on: f.occurred_on, is_discretionary: false });
    toast.success(`${type === "income" ? "Income" : "Transfer"} of ${formatMoney(Number(f.amount), currency)} recorded`); onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-3">
        <DialogHeader><DialogTitle>{type === "income" ? "Record income" : "Transfer between accounts"}</DialogTitle><DialogDescription>{type === "income" ? "Income raises what is available this period." : "Transfers do not change your total; they move money."}</DialogDescription></DialogHeader>
        <Field label="Amount" htmlFor="it-amount"><Input id="it-amount" type="number" inputMode="decimal" min={0} step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={type === "income" ? "Into account" : "From"} htmlFor="it-from"><Select id="it-from" value={f.account_id} onChange={(v) => setF({ ...f, account_id: v })}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
          {type === "transfer" ? <Field label="To" htmlFor="it-to"><Select id="it-to" value={f.to_account_id} onChange={(v) => setF({ ...f, to_account_id: v })}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field> : <Field label="Source" htmlFor="it-src"><Input id="it-src" value={f.merchant} onChange={(e) => setF({ ...f, merchant: e.target.value })} /></Field>}
          <Field label="Date" htmlFor="it-date"><Input id="it-date" type="date" value={f.occurred_on} onChange={(e) => setF({ ...f, occurred_on: e.target.value })} /></Field>
          <Field label="Note" htmlFor="it-note"><Input id="it-note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        </div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={!(Number(f.amount) > 0)}>Save</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  );
}

/** Corrections never edit in place: reverse, optionally re-post corrected values. */
export function TransactionDialog({ open, onOpenChange, tx }: { open: boolean; onOpenChange: (o: boolean) => void; tx: Transaction | null }) {
  const { userId } = useSession();
  const categories = useRowsOr("expense_categories");
  const accounts = useRowsOr("accounts");
  const currency = useCurrency();
  const [mode, setMode] = useState<"view" | "correct">("view");
  const [f, setF] = useState({ amount: "", category_id: "", account_id: "", merchant: "", note: "", occurred_on: todayKey() });
  const [confirmReverse, setConfirmReverse] = useState(false);
  useEffect(() => { if (open && tx) { setMode("view"); setF({ amount: String(tx.amount), category_id: tx.category_id ?? "", account_id: tx.account_id ?? "", merchant: tx.merchant ?? "", note: tx.note ?? "", occurred_on: tx.occurred_on }); } }, [open, tx]);
  if (!tx) return null;
  const correct = async () => {
    await reverseTransaction(userId, tx.id, { type: tx.type, amount: Number(f.amount), category_id: f.category_id || null, account_id: f.account_id || null, merchant: f.merchant || null, note: f.note || null, occurred_on: f.occurred_on, is_discretionary: tx.is_discretionary, source: "correction" });
    toast.success("Corrected. The original is kept as reversed."); onOpenChange(false);
  };
  const catName = categories.find((c) => c.id === tx.category_id)?.name ?? "Uncategorised";
  const accName = accounts.find((a) => a.id === tx.account_id)?.name ?? "—";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
      <DialogHeader><DialogTitle>{tx.merchant ?? catName}</DialogTitle><DialogDescription>{tx.type} · {tx.occurred_on} · {tx.status}</DialogDescription></DialogHeader>
      {mode === "view" ? (
        <div className="space-y-2 text-sm">
          <p className="text-3xl font-semibold tabular-nums">{formatMoney(tx.amount, currency)}</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground"><dt>Category</dt><dd className="text-foreground">{catName}</dd><dt>Account</dt><dd className="text-foreground">{accName}</dd><dt>Recorded</dt><dd className="text-foreground">{new Date(tx.created_at).toLocaleString()}</dd>{tx.note ? <><dt>Note</dt><dd className="text-foreground">{tx.note}</dd></> : null}{tx.reverses_id ? <><dt>Reverses</dt><dd className="font-mono text-xs">{tx.reverses_id.slice(0, 8)}</dd></> : null}</dl>
          {tx.status === "posted" ? (
            <DialogFooter className="pt-2"><Button variant="outline" onClick={() => setConfirmReverse(true)}>Reverse</Button><Button onClick={() => setMode("correct")}>Correct</Button></DialogFooter>
          ) : <p className="text-xs text-muted-foreground">This record is {tx.status} and kept for history.</p>}
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void correct(); }} className="space-y-3">
          <p className="rounded-lg bg-amber/10 px-3 py-2 text-xs text-amber">The original entry will be reversed and a corrected one posted. Both keep their timestamps.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount" htmlFor="tx-amount"><Input id="tx-amount" type="number" min={0} step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required autoFocus /></Field>
            <Field label="Date" htmlFor="tx-date"><Input id="tx-date" type="date" value={f.occurred_on} onChange={(e) => setF({ ...f, occurred_on: e.target.value })} /></Field>
            <Field label="Category" htmlFor="tx-cat"><Select id="tx-cat" value={f.category_id} onChange={(v) => setF({ ...f, category_id: v })}><option value="">Uncategorised</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="Account" htmlFor="tx-acc"><Select id="tx-acc" value={f.account_id} onChange={(v) => setF({ ...f, account_id: v })}><option value="">—</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
            <Field label="Merchant" htmlFor="tx-merchant"><Input id="tx-merchant" value={f.merchant} onChange={(e) => setF({ ...f, merchant: e.target.value })} /></Field>
            <Field label="Note" htmlFor="tx-note"><Input id="tx-note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setMode("view")}>Back</Button><Button type="submit" disabled={!(Number(f.amount) > 0)}>Post correction</Button></DialogFooter>
        </form>
      )}
      <ConfirmDialog open={confirmReverse} onOpenChange={setConfirmReverse} title="Reverse this transaction?" body="A mirror entry is posted and the original is marked reversed. Nothing is deleted." confirmLabel="Reverse" onConfirm={async () => { await reverseTransaction(userId, tx.id); toast.success("Reversed"); onOpenChange(false); }} />
    </DialogContent></Dialog>
  );
}
