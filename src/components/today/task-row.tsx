"use client";
import { toast } from "sonner";
import { useSession } from "@/lib/session/session-provider";
import { setTaskStatus, effectiveTaskStatus } from "@/lib/schedule/day";
import { todayKey, formatDateHuman, formatTime } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { IconCheck, IconSkip, IconClock, IconArrowRight } from "@/components/icons";
import { cn } from "@/lib/utils";
import { useUI } from "@/store/ui";

export function TaskRow({ task, dateKey, onEdit, showDate, compact }: { task: Task; dateKey?: string; onEdit?: (t: Task) => void; showDate?: boolean; compact?: boolean }) {
  const { userId } = useSession();
  const announce = useUI((s) => s.announce);
  const day = dateKey ?? todayKey();
  const status = effectiveTaskStatus(task, day);
  const done = status === "done";
  const act = async (s: Task["status"]) => {
    await setTaskStatus(userId, task, s, day);
    const msg = s === "done" ? "Task completed" : s === "skipped" ? "Task skipped" : s === "postponed" ? "Moved to tomorrow" : "Task reopened";
    announce(msg);
    toast(msg);
  };
  const prio = task.priority === 1 ? "bg-coral" : task.priority === 2 ? "bg-amber" : task.priority === 3 ? "bg-primary" : "bg-muted-foreground";
  return (
    <div className={cn("group flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-muted/60", done && "opacity-60")}>
      <button onClick={() => act(done ? "todo" : "done")} aria-pressed={done} aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`} className={cn("tap grid shrink-0 place-items-center rounded-full", compact && "min-h-10 min-w-10")}>
        <span className={cn("grid size-6 place-items-center rounded-full border-2 transition-colors", done ? "border-mint bg-mint text-mint-foreground" : "border-border group-hover:border-primary")}>{done ? <IconCheck size={14} /> : null}</span>
      </button>
      <button onClick={() => onEdit?.(task)} className="min-w-0 flex-1 text-left" disabled={!onEdit}>
        <span className={cn("block truncate text-sm font-medium", done && "line-through")}>{task.title}</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={cn("size-1.5 rounded-full", prio)} aria-hidden="true" />
          <span className="sr-only">Priority {task.priority}</span>
          {task.scheduled_start ? <span>{formatTime(task.scheduled_start)}</span> : null}
          {showDate && task.due_on ? <span>{formatDateHuman(task.due_on)}</span> : null}
          {task.category ? <span>{task.category}</span> : null}
          {status === "skipped" ? <span className="text-amber">Skipped</span> : null}
          {status === "postponed" ? <span className="text-amber">Postponed</span> : null}
        </span>
      </button>
      {!done && !compact ? (
        <div className="flex shrink-0 gap-0.5 opacity-70 focus-within:opacity-100 md:opacity-0 md:group-hover:opacity-100">
          <button onClick={() => act("skipped")} className="tap grid place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Skip ${task.title}`} title="Skip"><IconSkip size={16} /></button>
          <button onClick={() => act("postponed")} className="tap grid place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Postpone ${task.title} to tomorrow`} title="Tomorrow"><IconClock size={16} /></button>
          {onEdit ? <button onClick={() => onEdit(task)} className="tap grid place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Edit ${task.title}`} title="Edit"><IconArrowRight size={16} /></button> : null}
        </div>
      ) : null}
    </div>
  );
}
