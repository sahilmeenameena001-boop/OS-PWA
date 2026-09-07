"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { differenceInCalendarDays } from "date-fns";
import { useSession } from "@/lib/session/session-provider";
import { useRowsOr, useCurrency, useProfile } from "@/lib/data/hooks";
import { useMoneySnapshot } from "@/components/money/use-money-snapshot";
import { insert, update, remove } from "@/lib/data/repo";
import { contributeToGoal } from "@/lib/money/ledger";
import { purchaseImpact } from "@/lib/money/safe-to-spend";
import { getDB } from "@/lib/data/db";
import { formatMoney } from "@/lib/format";
import { todayKey, formatDateHuman, fromDateKey } from "@/lib/dates";
import { PageHeader, Panel, EmptyState, Field, ConfirmDialog, StatusPill } from "@/components/common";
import { SavingsJar } from "@/components/visuals/savings-jar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IconPlus, IconShield, IconEdit } from "@/components/icons";
import { useLiveQuery } from "dexie-react-hooks";
import type { SavingsGoal } from "@/lib/types";
import { newId } from "@/lib/ids";
import { cn } from "@/lib/utils";

interface CoolingItem {
  id: string;
  name: string;
  price: number;
  createdAt: string;
  waitUntil: string;
  status: "waiting" | "bought" | "rejected";
}

export default function SavingsPage() {
  const { userId } = useSession();
  const currency = useCurrency();
  const profile = useProfile();
  const snap = useMoneySnapshot();
  const goals = useRowsOr("savings_goals");
  const contributions = useRowsOr("savings_contributions");
  const accounts = useRowsOr("accounts").filter((a) => !a.is_archived);
  const [goalDlg, setGoalDlg] = useState<{ goal: SavingsGoal | null } | null>(null);
  const [contrib, setContrib] = useState<SavingsGoal | null>(null);
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [itemName, setItemName] = useState("");
  const [del, setDel] = useState<SavingsGoal | null>(null);
  const cooling = useLiveQuery(async () => ((await getDB().kv.get(`cooling:${userId}`))?.value as CoolingItem[] | undefined) ?? [], [userId]) ?? [];

  const savedFor = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of contributions) m.set(c.goal_id, (m.get(c.goal_id) ?? 0) + c.amount);
    return m;
  }, [contributions]);
  const topGoal = goals.filter((g) => g.status === "active").sort((a, b) => Number(b.is_emergency_fund) - Number(a.is_emergency_fund))[0] ?? null;
  const priceNum = Number(price);
  const impact = snap && priceNum > 0 ? purchaseImpact(priceNum, snap, topGoal) : null;

  const setCooling = (items: CoolingItem[]) => getDB().kv.put({ key: `cooling:${userId}`, value: items });
  const decide = async (decision: "buy" | "wait" | "reject") => {
    if (!impact || !priceNum) return;
    const name = itemName.trim() || "Purchase";
    if (decision === "wait") {
      const hours = Math.max(24, impact.suggestedWaitHours);
      await setCooling([{ id: newId(), name, price: priceNum, createdAt: new Date().toISOString(), waitUntil: new Date(Date.now() + hours * 3_600_000).toISOString(), status: "waiting" }, ...cooling]);
      toast(`Added to the cooling-off list for ${hours} hours`);
    } else if (decision === "reject") {
      await setCooling([{ id: newId(), name, price: priceNum, createdAt: new Date().toISOString(), waitUntil: new Date().toISOString(), status: "rejected" }, ...cooling]);
      toast.success(`Skipped. ${formatMoney(priceNum, currency)} stays with you.`);
    } else {
      await setCooling([{ id: newId(), name, price: priceNum, createdAt: new Date().toISOString(), waitUntil: new Date().toISOString(), status: "bought" }, ...cooling]);
      toast("Noted. Add the expense when you buy it.");
    }
    setPrice("");
    setItemName("");
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Savings" subtitle="Protected money is reserved before anything else is spent." actions={<Button size="sm" onClick={() => setGoalDlg({ goal: null })}><IconPlus size={16} /> Goal</Button>} />

      <div className="grid gap-4 md:grid-cols-3">
        <Panel className="flex items-center gap-4 md:col-span-1">
          <SavingsJar value={snap && profile ? Math.min(1, snap.protectedSavings / Math.max(profile.protected_savings_min, goals.filter((g) => g.is_protected).reduce((s, g) => s + g.target_amount, 0), 1)) : 0} label="Protected savings" size={110} />
          <div>
            <p className="flex items-center gap-1 text-xs font-medium tracking-wide text-muted-foreground uppercase"><IconShield size={14} /> Protected</p>
            <p className="text-2xl font-semibold tabular-nums text-mint">{snap ? formatMoney(snap.protectedSavings, currency) : "—"}</p>
            <p className="text-xs text-muted-foreground">Minimum {formatMoney(profile?.protected_savings_min ?? 0, currency)}</p>
          </div>
        </Panel>
        <Panel title="Before you buy something" className="md:col-span-2">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Field label="What is it?" htmlFor="pc-name"><Input id="pc-name" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Headphones" /></Field>
            <Field label="Price" htmlFor="pc-price"><Input id="pc-price" type="number" inputMode="decimal" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" /></Field>
          </div>
          {impact ? (
            <div className="anim-rise mt-3 space-y-3">
              <dl className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                <div className="rounded-lg bg-muted/60 p-2"><dt className="text-xs text-muted-foreground">Safe-to-spend today</dt><dd className="tabular-nums">{formatMoney(impact.safeTodayBefore, currency)} → <span className={impact.safeTodayAfter < impact.safeTodayBefore * 0.5 ? "text-amber" : ""}>{formatMoney(impact.safeTodayAfter, currency)}</span></dd></div>
                <div className="rounded-lg bg-muted/60 p-2"><dt className="text-xs text-muted-foreground">Share of what is left</dt><dd className="tabular-nums">{Math.round(impact.shareOfAvailable * 100)}%</dd></div>
                <div className="rounded-lg bg-muted/60 p-2"><dt className="text-xs text-muted-foreground">{topGoal ? `${topGoal.name} delayed by` : "Goal delay"}</dt><dd className="tabular-nums">{impact.goalDaysDelayed} day{impact.goalDaysDelayed === 1 ? "" : "s"}</dd></div>
                <div className="rounded-lg bg-muted/60 p-2"><dt className="text-xs text-muted-foreground">Suggested wait</dt><dd>{impact.suggestedWaitHours === 0 ? "None needed" : `${impact.suggestedWaitHours} hours`}</dd></div>
              </dl>
              <p className="text-sm text-muted-foreground">{impact.shareOfAvailable >= 0.5 ? "This would use most of what is left this period." : impact.shareOfAvailable >= 0.2 ? "A noticeable dent. Waiting a couple of days keeps the choice yours." : "This fits comfortably within what is available."}</p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => decide("buy")}>Buy</Button>
                <Button variant="secondary" onClick={() => decide("wait")}>Wait {Math.max(24, impact.suggestedWaitHours)} hours</Button>
                <Button variant="outline" onClick={() => decide("reject")}>Reject</Button>
              </div>
            </div>
          ) : <p className="mt-2 text-xs text-muted-foreground">Enter a price to see its impact on today and on your goals.</p>}
        </Panel>
      </div>

      <Panel title="Goals">
        {goals.length === 0 ? <EmptyState title="No goals yet" body="An emergency fund is a calm place to start." action={<Button onClick={() => setGoalDlg({ goal: null })}>Create goal</Button>} /> : (
          <ul className="grid gap-3 md:grid-cols-2">
            {goals.map((g) => {
              const saved = savedFor.get(g.id) ?? 0;
              const pct = g.target_amount > 0 ? Math.min(1, saved / g.target_amount) : 0;
              const daysLeft = g.deadline ? differenceInCalendarDays(fromDateKey(g.deadline), new Date()) : null;
              const needPerMonth = g.deadline && daysLeft && daysLeft > 0 ? ((g.target_amount - saved) / daysLeft) * 30 : null;
              return (
                <li key={g.id} className={cn("flex items-center gap-3 rounded-2xl border border-border p-3", g.status === "completed" && "opacity-70")}>
                  <SavingsJar value={pct} label={g.name} size={80} tone={g.is_emergency_fund ? "mint" : g.is_protected ? "primary" : "amber"} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1 text-sm font-medium"><span className="truncate">{g.name}</span>{g.is_protected ? <StatusPill tone="mint"><IconShield size={10} /> protected</StatusPill> : null}{g.status === "completed" ? <StatusPill tone="mint">done</StatusPill> : null}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{formatMoney(saved, currency)} of {formatMoney(g.target_amount, currency)} · {Math.round(pct * 100)}%</p>
                    {g.deadline ? <p className="text-xs text-muted-foreground">{daysLeft !== null && daysLeft >= 0 ? `${daysLeft} days left` : "Deadline passed"}{needPerMonth && needPerMonth > 0 ? ` · ~${formatMoney(needPerMonth, currency, { compact: true })}/month to finish` : ""}</p> : null}
                    <div className="mt-2 flex gap-1">
                      <Button size="sm" onClick={() => { setContrib(g); setAmount(String(g.planned_monthly || "")); }}>Add money</Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`Edit ${g.name}`} onClick={() => setGoalDlg({ goal: g })}><IconEdit size={14} /></Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Cooling-off list">
        {cooling.length === 0 ? <p className="text-sm text-muted-foreground">Nothing waiting. Purchases you decide to sleep on appear here.</p> : (
          <ul className="space-y-1">
            {cooling.slice(0, 20).map((c) => {
              const ready = new Date(c.waitUntil).getTime() <= Date.now();
              return (
                <li key={c.id} className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-muted/50">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{formatMoney(c.price, currency)} · {c.status === "waiting" ? (ready ? "Wait is over. Still want it?" : `Decide after ${formatDateHuman(c.waitUntil.slice(0, 10))}`) : c.status}</p></div>
                  {c.status === "waiting" ? (
                    <>
                      <Button size="sm" variant="outline" disabled={!ready} onClick={() => setCooling(cooling.map((x) => (x.id === c.id ? { ...x, status: "bought" } : x)))}>Buy</Button>
                      <Button size="sm" variant="ghost" onClick={() => setCooling(cooling.map((x) => (x.id === c.id ? { ...x, status: "rejected" } : x)))}>Let it go</Button>
                    </>
                  ) : <StatusPill tone={c.status === "rejected" ? "mint" : "muted"}>{c.status}</StatusPill>}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <GoalDialog open={Boolean(goalDlg)} onOpenChange={(o) => !o && setGoalDlg(null)} goal={goalDlg?.goal ?? null} onDelete={(g) => { setGoalDlg(null); setDel(g); }} />
      <Dialog open={Boolean(contrib)} onOpenChange={(o) => !o && setContrib(null)}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={async (e) => { e.preventDefault(); if (!contrib || !(Number(amount) > 0)) return; await contributeToGoal(userId, contrib.id, Number(amount), accounts[0]?.id ?? null); const total = (savedFor.get(contrib.id) ?? 0) + Number(amount); if (total >= contrib.target_amount && contrib.status === "active") await update("savings_goals", userId, contrib.id, { status: "completed" }); toast.success(`${formatMoney(Number(amount), currency)} added to ${contrib.name}`); setContrib(null); }} className="space-y-3">
            <DialogHeader><DialogTitle>Add to {contrib?.name}</DialogTitle><DialogDescription>Recorded as a contribution transaction.</DialogDescription></DialogHeader>
            <Field label="Amount" htmlFor="contrib-amount"><Input id="contrib-amount" type="number" inputMode="decimal" min={0} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus /></Field>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setContrib(null)}>Cancel</Button><Button type="submit" disabled={!(Number(amount) > 0)}>Add</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={Boolean(del)} onOpenChange={(o) => !o && setDel(null)} title={`Delete ${del?.name}?`} body="Contribution history stays in your transactions." confirmLabel="Delete" destructive onConfirm={async () => { if (del) await remove("savings_goals", userId, del.id); }} />
    </div>
  );
}

function GoalDialog({ open, onOpenChange, goal, onDelete }: { open: boolean; onOpenChange: (o: boolean) => void; goal: SavingsGoal | null; onDelete: (g: SavingsGoal) => void }) {
  const { userId } = useSession();
  const [f, setF] = useState({ name: "", target_amount: "", deadline: "", is_protected: true, is_emergency_fund: false, planned_monthly: "" });
  const reset = () => setF({ name: goal?.name ?? "", target_amount: goal ? String(goal.target_amount) : "", deadline: goal?.deadline ?? "", is_protected: goal?.is_protected ?? true, is_emergency_fund: goal?.is_emergency_fund ?? false, planned_monthly: goal ? String(goal.planned_monthly) : "" });
  const save = async () => {
    const data = { name: f.name.trim(), target_amount: Number(f.target_amount) || 0, deadline: f.deadline || null, is_protected: f.is_protected, is_emergency_fund: f.is_emergency_fund, planned_monthly: Number(f.planned_monthly) || 0 };
    if (goal) await update("savings_goals", userId, goal.id, data); else await insert("savings_goals", userId, { ...data, color: "mint", status: "active" });
    toast.success("Goal saved"); onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) reset(); onOpenChange(o); }}>
      <DialogContent>
        <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-3">
          <DialogHeader><DialogTitle>{goal ? "Edit goal" : "New savings goal"}</DialogTitle><DialogDescription>Protected goals are excluded from spending money.</DialogDescription></DialogHeader>
          <Field label="Name" htmlFor="goal-name"><Input id="goal-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required autoFocus /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target" htmlFor="goal-target"><Input id="goal-target" type="number" min={0} value={f.target_amount} onChange={(e) => setF({ ...f, target_amount: e.target.value })} required /></Field>
            <Field label="Deadline" htmlFor="goal-deadline"><Input id="goal-deadline" type="date" min={todayKey()} value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></Field>
            <Field label="Planned per month" htmlFor="goal-monthly" className="col-span-2"><Input id="goal-monthly" type="number" min={0} value={f.planned_monthly} onChange={(e) => setF({ ...f, planned_monthly: e.target.value })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={f.is_protected} onChange={(e) => setF({ ...f, is_protected: e.target.checked })} /> Protected (never counted as spendable)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={f.is_emergency_fund} onChange={(e) => setF({ ...f, is_emergency_fund: e.target.checked })} /> This is my emergency fund</label>
          <DialogFooter className="sm:justify-between">{goal ? <Button type="button" variant="destructive" onClick={() => onDelete(goal)}>Delete</Button> : <span />}<div className="flex gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={!f.name.trim()}>Save</Button></div></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
