"use client";
import Link from "next/link";
import { useMoneySnapshot } from "@/components/money/use-money-snapshot";
import { useCurrency } from "@/lib/data/hooks";
import { formatMoney } from "@/lib/format";
import { ProgressRing } from "@/components/visuals/progress-ring";
import { Button } from "@/components/ui/button";
import { useUI } from "@/store/ui";
import { IconPlus } from "@/components/icons";

export function SafeToSpendCard({ compact }: { compact?: boolean }) {
  const snap = useMoneySnapshot();
  const currency = useCurrency();
  const openExpense = useUI((s) => s.openExpense);
  if (!snap) return <div className="skeleton h-32 rounded-2xl" aria-busy="true" />;
  const usedToday = snap.safeToSpendToday + snap.spentToday > 0 ? snap.spentToday / (snap.safeToSpendToday + snap.spentToday) : 0;
  const tone = snap.availableForSpending <= 0 ? "coral" : usedToday > 0.9 ? "amber" : "mint";
  const remainingToday = Math.max(0, snap.safeToSpendToday);
  return (
    <div className="glass relative overflow-hidden rounded-2xl p-4 md:p-5">
      <div className="flex items-center gap-4">
        <ProgressRing value={usedToday} tone={tone} size={compact ? 64 : 84} label="Today's spending used">
          <span className="text-xs">{Math.round(usedToday * 100)}%</span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Safe to spend today</p>
          <p className={`text-2xl font-semibold tabular-nums md:text-3xl ${tone === "coral" ? "text-coral" : tone === "amber" ? "text-amber" : ""}`}>{formatMoney(remainingToday, currency)}</p>
          <p className="text-xs text-muted-foreground">
            Spent {formatMoney(snap.spentToday, currency)} today · {formatMoney(Math.max(snap.availableForSpending, 0), currency)} left for {snap.period.remainingDays} day{snap.period.remainingDays === 1 ? "" : "s"}
          </p>
        </div>
        <Button size="icon-lg" onClick={openExpense} aria-label="Add expense" className="shrink-0 rounded-full"><IconPlus size={22} /></Button>
      </div>
      {!compact ? (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-muted/60 p-2"><p className="text-muted-foreground">Bills left</p><p className="font-semibold tabular-nums">{formatMoney(snap.billsRemaining + snap.subscriptionsRemaining, currency, { compact: true })}</p></div>
          <div className="rounded-lg bg-muted/60 p-2"><p className="text-muted-foreground">Protected</p><p className="font-semibold tabular-nums text-mint">{formatMoney(snap.protectedSavings, currency, { compact: true })}</p></div>
          <Link href="/money" className="rounded-lg bg-muted/60 p-2 hover:bg-muted"><p className="text-muted-foreground">Month-end</p><p className={`font-semibold tabular-nums ${snap.projectedMonthEnd < 0 ? "text-coral" : ""}`}>{formatMoney(snap.projectedMonthEnd, currency, { compact: true })}</p></Link>
        </div>
      ) : null}
    </div>
  );
}
