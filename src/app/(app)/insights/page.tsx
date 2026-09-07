"use client";
import { useMemo } from "react";
import { format, subMonths } from "date-fns";
import { useRowsOr, useCurrency, useCategoryMap } from "@/lib/data/hooks";
import { useMoneySnapshot } from "@/components/money/use-money-snapshot";
import { formatMoney } from "@/lib/format";
import { todayKey, toDateKey } from "@/lib/dates";
import { unusualExpenses } from "@/lib/money/safe-to-spend";
import { PageHeader, Panel, Stat, EmptyState } from "@/components/common";
import { subDays } from "date-fns";

const COLORS = ["var(--primary)", "var(--mint)", "var(--amber)", "var(--violet)", "var(--coral)", "var(--muted-foreground)"];

export default function InsightsPage() {
  const currency = useCurrency();
  const snap = useMoneySnapshot();
  const txs = useRowsOr("transactions");
  const tasks = useRowsOr("tasks");
  const inbox = useRowsOr("inbox_items");
  const habits = useRowsOr("habits");
  const logs = useRowsOr("habit_logs");
  const catMap = useCategoryMap();
  const today = todayKey();

  const months = useMemo(() => Array.from({ length: 6 }, (_, i) => { const d = subMonths(new Date(), 5 - i); return { key: format(d, "yyyy-MM"), label: format(d, "MMM") }; }), []);
  const monthly = useMemo(() => months.map((m) => ({ ...m, spent: txs.filter((t) => t.status === "posted" && t.type === "expense" && t.occurred_on.startsWith(m.key)).reduce((s, t) => s + t.amount, 0), income: txs.filter((t) => t.status === "posted" && t.type === "income" && t.occurred_on.startsWith(m.key)).reduce((s, t) => s + t.amount, 0) })), [months, txs]);
  const maxMonthly = Math.max(1, ...monthly.map((m) => Math.max(m.spent, m.income)));
  const byCat = useMemo(() => {
    if (!snap) return [];
    const m = new Map<string, number>();
    for (const t of txs) if (t.status === "posted" && t.type === "expense" && t.occurred_on >= snap.period.start && t.occurred_on <= snap.period.end) m.set(t.category_id ?? "", (m.get(t.category_id ?? "") ?? 0) + t.amount);
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    return [...m.entries()].map(([id, v]) => ({ id, name: catMap.get(id)?.name ?? "Uncategorised", value: v, pct: total ? v / total : 0 })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [snap, txs, catMap]);
  const unusual = useMemo(() => (snap ? unusualExpenses(txs, snap.period.start, snap.period.end) : { repeated: [], large: [] }), [snap, txs]);
  const last30 = useMemo(() => Array.from({ length: 30 }, (_, i) => toDateKey(subDays(new Date(), 29 - i))), []);
  const tasksPerDay = last30.map((d) => tasks.filter((t) => t.status === "done" && t.completed_at?.slice(0, 10) === d).length);
  const maxTasks = Math.max(1, ...tasksPerDay);
  const capturesLast30 = inbox.filter((i) => i.captured_at.slice(0, 10) >= last30[0]).length;
  const habitRate = useMemo(() => {
    let planned = 0, done = 0;
    for (const d of last30) { const dow = new Date(d + "T00:00:00").getDay(); planned += habits.filter((h) => h.is_active && h.schedule_days.includes(dow)).length; done += logs.filter((l) => l.log_date === d && l.status === "done").length; }
    return planned ? done / planned : 0;
  }, [last30, habits, logs]);
  const discretionary = useMemo(() => (snap ? txs.filter((t) => t.status === "posted" && t.type === "expense" && t.is_discretionary && t.occurred_on >= snap.period.start && t.occurred_on <= snap.period.end).reduce((s, t) => s + t.amount, 0) : 0), [snap, txs]);

  // donut geometry
  let acc = 0;
  const arcs = byCat.map((c, i) => { const start = acc; acc += c.pct; return { ...c, start, end: acc, color: COLORS[i % COLORS.length] }; });
  const arcPath = (s: number, e: number) => { const r = 42, cx = 50, cy = 50; const a0 = s * Math.PI * 2 - Math.PI / 2, a1 = e * Math.PI * 2 - Math.PI / 2; const large = e - s > 0.5 ? 1 : 0; return `M ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}`; };

  return (
    <div className="space-y-4">
      <PageHeader title="Insights" subtitle="Patterns from your own records. No guesses, no external services." />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Spent this period" value={snap ? formatMoney(snap.spentThisPeriod, currency) : "—"} />
        <Stat label="Discretionary share" value={snap && snap.spentThisPeriod ? `${Math.round((discretionary / snap.spentThisPeriod) * 100)}%` : "—"} hint={formatMoney(discretionary, currency)} tone="amber" />
        <Stat label="Habit consistency (30d)" value={`${Math.round(habitRate * 100)}%`} tone="mint" />
        <Stat label="Captures (30d)" value={capturesLast30} tone="primary" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Spending vs income, last 6 months">
          <svg viewBox="0 0 360 160" className="h-44 w-full" role="img" aria-label={`Monthly totals: ${monthly.map((m) => `${m.label} spent ${Math.round(m.spent)}, income ${Math.round(m.income)}`).join("; ")}`}>
            {monthly.map((m, i) => { const x = 20 + i * 56; const hs = (m.spent / maxMonthly) * 110; const hi = (m.income / maxMonthly) * 110; return (
              <g key={m.key}>
                <rect x={x} y={125 - hi} width="18" height={hi} rx="4" fill="var(--mint)" opacity="0.8" />
                <rect x={x + 22} y={125 - hs} width="18" height={hs} rx="4" fill="var(--primary)" />
                <text x={x + 20} y="145" textAnchor="middle" fontSize="11" fill="currentColor" fillOpacity="0.7">{m.label}</text>
              </g>); })}
            <g fontSize="10" fill="currentColor" fillOpacity="0.7"><rect x="250" y="6" width="10" height="10" rx="2" fill="var(--mint)" /><text x="264" y="15">Income</text><rect x="310" y="6" width="10" height="10" rx="2" fill="var(--primary)" /><text x="324" y="15">Spent</text></g>
          </svg>
          <table className="sr-only"><caption>Monthly totals</caption><tbody>{monthly.map((m) => <tr key={m.key}><td>{m.label}</td><td>{formatMoney(m.income, currency)}</td><td>{formatMoney(m.spent, currency)}</td></tr>)}</tbody></table>
        </Panel>
        <Panel title="Where it went this period">
          {arcs.length === 0 ? <EmptyState title="No expenses yet" /> : (
            <div className="flex items-center gap-4">
              <svg viewBox="0 0 100 100" className="size-36 shrink-0" role="img" aria-label={arcs.map((a) => `${a.name} ${Math.round(a.pct * 100)}%`).join(", ")}>
                {arcs.map((a) => <path key={a.id} d={arcPath(a.start, Math.max(a.end - 0.004, a.start))} stroke={a.color} strokeWidth="14" fill="none" strokeLinecap="butt" />)}
                <text x="50" y="54" textAnchor="middle" fontSize="11" fill="currentColor" fontWeight="600">{snap ? formatMoney(snap.spentThisPeriod, currency, { compact: true }) : ""}</text>
              </svg>
              <ul className="flex-1 space-y-1 text-sm">{arcs.map((a) => <li key={a.id} className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: a.color }} aria-hidden="true" /><span className="flex-1 truncate">{a.name}</span><span className="tabular-nums text-muted-foreground">{Math.round(a.pct * 100)}%</span><span className="tabular-nums">{formatMoney(a.value, currency, { compact: true })}</span></li>)}</ul>
            </div>
          )}
        </Panel>
        <Panel title="Tasks completed, last 30 days">
          <svg viewBox="0 0 360 100" className="h-28 w-full" role="img" aria-label={`Tasks completed per day over 30 days, total ${tasksPerDay.reduce((a, b) => a + b, 0)}`}>
            <polyline fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" points={tasksPerDay.map((n, i) => `${10 + i * 11.7},${85 - (n / maxTasks) * 70}`).join(" ")} className="anim-draw" />
            {tasksPerDay.map((n, i) => n > 0 ? <circle key={i} cx={10 + i * 11.7} cy={85 - (n / maxTasks) * 70} r="2.5" fill="var(--primary)" /> : null)}
            <text x="10" y="98" fontSize="10" fill="currentColor" fillOpacity="0.6">{last30[0].slice(5)}</text><text x="350" y="98" fontSize="10" textAnchor="end" fill="currentColor" fillOpacity="0.6">{today.slice(5)}</text>
          </svg>
        </Panel>
        <Panel title="Unusual or repeated">
          {unusual.repeated.length === 0 && unusual.large.length === 0 ? <p className="text-sm text-muted-foreground">Spending looks steady this period.</p> : (
            <ul className="space-y-1 text-sm">
              {unusual.repeated.map((r) => <li key={r.merchant} className="flex justify-between"><span className="capitalize">{r.merchant} × {r.count}</span><span className="tabular-nums">{formatMoney(r.total, currency)}</span></li>)}
              {unusual.large.map((t) => <li key={t.id} className="flex justify-between"><span>{t.merchant ?? "Large expense"} · {t.occurred_on}</span><span className="tabular-nums">{formatMoney(t.amount, currency)}</span></li>)}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
