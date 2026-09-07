"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSession } from "@/lib/session/session-provider";
import { useRowsOr } from "@/lib/data/hooks";
import { insert, update } from "@/lib/data/repo";
import { DEFAULT_CATEGORIES } from "@/lib/data/seed";
import { todayKey, toDateKey } from "@/lib/dates";
import { addDays } from "date-fns";
import { CompassHero } from "@/components/visuals/compass";
import { Field } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const STEPS = ["Welcome", "Income", "Fixed bills", "Debts", "Savings", "Balances", "Categories"];

export default function OnboardingPage() {
  const { userId, profile } = useSession();
  const router = useRouter();
  const existingCats = useRowsOr("expense_categories");
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile?.display_name ?? "");
  const [income, setIncome] = useState(profile?.monthly_income ? String(profile.monthly_income) : "");
  const [incomeDay, setIncomeDay] = useState(String(profile?.income_day ?? 1));
  const [bills, setBills] = useState([{ name: "Rent", amount: "", day: "5" }, { name: "Electricity", amount: "", day: "10" }]);
  const [debts, setDebts] = useState([{ name: "", remaining: "", monthly: "" }]);
  const [protectedMin, setProtectedMin] = useState("");
  const [emergencyTarget, setEmergencyTarget] = useState("");
  const [accounts, setAccounts] = useState([{ name: "Bank", type: "bank", balance: "" }, { name: "Cash", type: "cash", balance: "" }, { name: "UPI", type: "upi", balance: "" }]);
  const [cats, setCats] = useState<string[]>(DEFAULT_CATEGORIES.map((c) => c.name));
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    setBusy(true);
    try {
      const inc = Number(income) || 0;
      const totalBalance = accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0);
      await update("profiles", userId, userId, { display_name: name.trim() || null, monthly_income: inc, income_day: Math.min(28, Math.max(1, Number(incomeDay) || 1)), opening_balance: totalBalance, protected_savings_min: Number(protectedMin) || 0, daily_limit: null, weekly_limit: null, onboarding_completed: true });
      if (existingCats.length === 0) for (const [i, c] of DEFAULT_CATEGORIES.entries()) if (cats.includes(c.name)) await insert("expense_categories", userId, { ...c, sort_order: i, is_archived: false });
      for (const [i, a] of accounts.entries()) if (a.name.trim()) await insert("accounts", userId, { name: a.name.trim(), type: a.type as "bank" | "cash" | "upi" | "card", opening_balance: Number(a.balance) || 0, currency: "INR", is_archived: false, sort_order: i });
      const now = new Date();
      for (const b of bills) if (b.name.trim() && Number(b.amount) > 0) { const day = Math.min(28, Math.max(1, Number(b.day) || 1)); const due = new Date(now.getFullYear(), now.getMonth(), day); await insert("bills", userId, { name: b.name.trim(), amount: Number(b.amount), frequency: "monthly", next_due_on: toDateKey(due < now ? new Date(now.getFullYear(), now.getMonth() + 1, day) : due), category_id: null, account_id: null, is_fixed: true, last_paid_on: null, status: "active" }); }
      for (const d of debts) if (d.name.trim() && Number(d.monthly) > 0) await insert("debts", userId, { name: d.name.trim(), lender: null, principal: Number(d.remaining) || 0, remaining: Number(d.remaining) || 0, monthly_payment: Number(d.monthly), due_day: null, status: "active" });
      await insert("savings_goals", userId, { name: "Protected savings", target_amount: Number(protectedMin) || 0, deadline: null, is_protected: true, is_emergency_fund: false, color: "blue", status: "active", planned_monthly: Math.round(inc * 0.1) });
      await insert("savings_goals", userId, { name: "Emergency fund", target_amount: Number(emergencyTarget) || inc * 3, deadline: toDateKey(addDays(now, 365)), is_protected: true, is_emergency_fund: true, color: "mint", status: "active", planned_monthly: Math.round(inc * 0.1) });
      toast.success("You're set. Welcome.");
      router.replace("/");
    } finally { setBusy(false); }
  };

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="mx-auto max-w-lg">
      <ol className="mb-4 flex gap-1" aria-label="Progress">{STEPS.map((s, i) => <li key={s} className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} aria-current={i === step ? "step" : undefined}><span className="sr-only">{s}</span></li>)}</ol>
      <div className="glass rounded-3xl p-6">
        {step === 0 ? (
          <div className="text-center">
            <CompassHero size={220} />
            <h1 className="mt-4 text-2xl font-semibold">Your personal compass</h1>
            <p className="mt-2 text-sm text-muted-foreground">Today, money, memory and habits in one calm place. Seven quick questions set up your safe-to-spend number. You can change everything later.</p>
            <Field label="What should we call you?" htmlFor="ob-name" className="mt-5 text-left"><Input id="ob-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
          </div>
        ) : null}
        {step === 1 ? (<div className="space-y-4"><h2 className="text-xl font-semibold">Income</h2><Field label="Monthly income (after tax)" htmlFor="ob-income"><Input id="ob-income" type="number" inputMode="decimal" min={0} value={income} onChange={(e) => setIncome(e.target.value)} autoFocus /></Field><Field label="Day of month it arrives" htmlFor="ob-day" hint="This starts your budget period."><Input id="ob-day" type="number" min={1} max={28} value={incomeDay} onChange={(e) => setIncomeDay(e.target.value)} /></Field></div>) : null}
        {step === 2 ? (<div className="space-y-3"><h2 className="text-xl font-semibold">Fixed bills</h2><p className="text-sm text-muted-foreground">Reserved before anything else. Leave blank to skip.</p>{bills.map((b, i) => <div key={i} className="grid grid-cols-[1fr_90px_60px] gap-2"><Input aria-label="Bill name" value={b.name} onChange={(e) => setBills(bills.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /><Input aria-label="Amount" type="number" inputMode="decimal" placeholder="Amount" value={b.amount} onChange={(e) => setBills(bills.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} /><Input aria-label="Due day" type="number" min={1} max={28} placeholder="Day" value={b.day} onChange={(e) => setBills(bills.map((x, j) => (j === i ? { ...x, day: e.target.value } : x)))} /></div>)}<Button variant="outline" size="sm" onClick={() => setBills([...bills, { name: "", amount: "", day: "1" }])}>Add another</Button></div>) : null}
        {step === 3 ? (<div className="space-y-3"><h2 className="text-xl font-semibold">Debt payments</h2><p className="text-sm text-muted-foreground">EMIs, loans, cards. Skip if none.</p>{debts.map((d, i) => <div key={i} className="grid grid-cols-[1fr_100px_100px] gap-2"><Input aria-label="Debt name" placeholder="Laptop EMI" value={d.name} onChange={(e) => setDebts(debts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /><Input aria-label="Remaining" type="number" placeholder="Remaining" value={d.remaining} onChange={(e) => setDebts(debts.map((x, j) => (j === i ? { ...x, remaining: e.target.value } : x)))} /><Input aria-label="Monthly" type="number" placeholder="Monthly" value={d.monthly} onChange={(e) => setDebts(debts.map((x, j) => (j === i ? { ...x, monthly: e.target.value } : x)))} /></div>)}<Button variant="outline" size="sm" onClick={() => setDebts([...debts, { name: "", remaining: "", monthly: "" }])}>Add another</Button></div>) : null}
        {step === 4 ? (<div className="space-y-4"><h2 className="text-xl font-semibold">Protected savings</h2><Field label="Minimum you never want to dip below" htmlFor="ob-protected" hint="Excluded from safe-to-spend, always."><Input id="ob-protected" type="number" min={0} value={protectedMin} onChange={(e) => setProtectedMin(e.target.value)} autoFocus /></Field><Field label="Emergency fund target" htmlFor="ob-emergency" hint={`Default: three months of income${income ? ` (${Number(income) * 3})` : ""}.`}><Input id="ob-emergency" type="number" min={0} value={emergencyTarget} onChange={(e) => setEmergencyTarget(e.target.value)} /></Field></div>) : null}
        {step === 5 ? (<div className="space-y-3"><h2 className="text-xl font-semibold">Current balances</h2>{accounts.map((a, i) => <div key={i} className="grid grid-cols-[1fr_90px_110px] gap-2"><Input aria-label="Account name" value={a.name} onChange={(e) => setAccounts(accounts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /><select aria-label="Type" className="tap rounded-lg border border-input bg-background px-2 text-sm" value={a.type} onChange={(e) => setAccounts(accounts.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}><option value="bank">Bank</option><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option></select><Input aria-label="Balance" type="number" placeholder="Balance" value={a.balance} onChange={(e) => setAccounts(accounts.map((x, j) => (j === i ? { ...x, balance: e.target.value } : x)))} /></div>)}<Button variant="outline" size="sm" onClick={() => setAccounts([...accounts, { name: "", type: "card", balance: "" }])}>Add account</Button></div>) : null}
        {step === 6 ? (<div className="space-y-3"><h2 className="text-xl font-semibold">Spending categories</h2><p className="text-sm text-muted-foreground">Tap to keep or drop. Add more later.</p><div className="flex flex-wrap gap-2">{DEFAULT_CATEGORIES.map((c) => <button key={c.name} onClick={() => setCats(cats.includes(c.name) ? cats.filter((x) => x !== c.name) : [...cats, c.name])} aria-pressed={cats.includes(c.name)} className={cn("tap rounded-full border px-3 text-sm", cats.includes(c.name) ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{c.name}</button>)}</div></div>) : null}
        <div className="mt-6 flex justify-between gap-2">
          <Button variant="ghost" onClick={back} disabled={step === 0}>Back</Button>
          {step < STEPS.length - 1 ? <Button onClick={next}>Continue</Button> : <Button onClick={finish} disabled={busy}>{busy ? "Setting up…" : "Finish"}</Button>}
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">Today is {todayKey()}. Nothing here is financial advice; it is arithmetic on your own numbers.</p>
      </div>
    </div>
  );
}
