"use client";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/data/db";
import { useSession } from "@/lib/session/session-provider";
import { useRowsOr } from "@/lib/data/hooks";
import { useUI } from "@/store/ui";
import { Button } from "@/components/ui/button";
import { IconCheck, IconClose, IconCapture, IconMoney, IconHabits, IconSavings, IconCalendar } from "@/components/icons";
import { cn } from "@/lib/utils";

/** First-run checklist. Ticks itself off as the person uses the app; hides once complete or dismissed. */
export function GettingStarted({ onAddTask }: { onAddTask: () => void }) {
  const { userId } = useSession();
  const openCapture = useUI((s) => s.openCapture);
  const openExpense = useUI((s) => s.openExpense);
  const inbox = useRowsOr("inbox_items");
  const tasks = useRowsOr("tasks");
  const transactions = useRowsOr("transactions");
  const habits = useRowsOr("habits");
  const goals = useRowsOr("savings_goals");
  const contributions = useRowsOr("savings_contributions");
  const key = `guide:dismissed:${userId}`;
  const dismissed = useLiveQuery(async () => Boolean((await getDB().kv.get(key))?.value), [key], false);

  const steps = [
    { id: "capture", title: "Capture a thought", body: "Anything on your mind. It lands in the Inbox, sort it later.", done: inbox.length > 0, Icon: IconCapture, action: <Button size="sm" onClick={() => openCapture()}>Capture</Button> },
    { id: "task", title: "Add today's first task", body: "Give it a time and it appears on your timeline.", done: tasks.length > 0, Icon: IconCalendar, action: <Button size="sm" onClick={onAddTask}>Add task</Button> },
    { id: "expense", title: "Log an expense", body: "Amount, category, save. Your safe-to-spend updates instantly.", done: transactions.some((t) => t.type === "expense"), Icon: IconMoney, action: <Button size="sm" onClick={openExpense}>Add expense</Button> },
    { id: "habit", title: "Add a habit or medicine", body: "Daily check-ins with gentle reminders.", done: habits.length > 0, Icon: IconHabits, action: <Button size="sm" nativeButton={false} render={<Link href="/habits" />}>Open Habits</Button> },
    { id: "savings", title: "Put money into a savings goal", body: "Protected savings are never counted as spendable.", done: goals.length > 0 && contributions.length > 0, Icon: IconSavings, action: <Button size="sm" nativeButton={false} render={<Link href="/savings" />}>Open Savings</Button> },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (dismissed || doneCount === steps.length) return null;

  return (
    <section className="glass anim-rise relative rounded-2xl border-primary/30 p-4 md:p-5" aria-labelledby="gs-title">
      <button onClick={() => getDB().kv.put({ key, value: true })} className="tap absolute top-1 right-1 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Hide getting started">
        <IconClose size={16} />
      </button>
      <h2 id="gs-title" className="text-base font-semibold">Getting started · {doneCount}/{steps.length}</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">Five small actions and the app starts working for you. Do them in any order.</p>
      <div className="mt-3 h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-primary transition-[width] duration-500" style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>
      <ol className="mt-3 space-y-1">
        {steps.map((s, i) => (
          <li key={s.id} className={cn("flex items-center gap-3 rounded-xl px-2 py-2", s.done && "opacity-60")}>
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", s.done ? "bg-mint text-mint-foreground" : "bg-primary/10 text-primary")}>{s.done ? <IconCheck size={16} /> : <s.Icon size={16} />}</span>
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-medium", s.done && "line-through")}>{i + 1}. {s.title}</p>
              <p className="text-xs text-muted-foreground">{s.body}</p>
            </div>
            {!s.done ? <div className="shrink-0">{s.action}</div> : null}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">Tip: the big + button (or the Capture tab on your phone) works from every screen. Press ⌘K / Ctrl K to search anything.</p>
    </section>
  );
}
