"use client";
import { useEffect, useState } from "react";
import type { DayItem } from "@/lib/schedule/day";
import { minutesSinceMidnight } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { IconCheck } from "@/components/icons";

const START = 6 * 60;
const END = 23 * 60;
const SPAN = END - START;
const H = 95;

/** Animated day timeline: an SVG path (stretches to any width) with fixed-size HTML markers placed by time. */
export function DayTimeline({ items, isToday, onSelect }: { items: DayItem[]; isToday: boolean; onSelect?: (item: DayItem) => void }) {
  const [now, setNow] = useState(() => minutesSinceMidnight(new Date()));
  useEffect(() => {
    const id = window.setInterval(() => setNow(minutesSinceMidnight(new Date())), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const timed = items.filter((i) => i.start);
  const pct = (m: number) => Math.max(0, Math.min(1, (m - START) / SPAN));
  const colorVar = (c: DayItem["color"]) => `var(--${c})`;
  const place = (p: number) => ({ left: `${1 + p * 98}%`, top: `${(yOnPath(10 + p * 980) / H) * 100}%` });
  return (
    <div className="relative">
      <div className="relative h-20 md:h-24">
        <svg viewBox={`0 0 1000 ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id="tl-path" x1="0" x2="1">
              <stop offset="0" stopColor="var(--amber)" />
              <stop offset="0.5" stopColor="var(--primary)" />
              <stop offset="1" stopColor="var(--violet)" />
            </linearGradient>
          </defs>
          <path d="M10 70 C 200 20, 350 110, 500 60 S 800 20, 990 70" fill="none" stroke="var(--muted)" strokeWidth="5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d="M10 70 C 200 20, 350 110, 500 60 S 800 20, 990 70" fill="none" stroke="url(#tl-path)" strokeWidth="5" strokeLinecap="round" vectorEffect="non-scaling-stroke" className="anim-draw" />
        </svg>
        {isToday ? (
          <span className="absolute size-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20" style={place(pct(now))} aria-hidden="true">
            <span className="absolute inset-0 m-auto size-3 rounded-full bg-primary" />
          </span>
        ) : null}
        <ul aria-label={`Timeline with ${timed.length} scheduled items`}>
          {timed.map((it) => {
            const done = it.status === "done";
            return (
              <li key={it.key} className="absolute -translate-x-1/2 -translate-y-1/2" style={place(pct(minutesSinceMidnight(it.start!)))}>
                <button onClick={() => onSelect?.(it)} disabled={!onSelect} aria-label={`${it.title} at ${it.start!.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`} className={cn("grid size-6 place-items-center rounded-full border-[3px] bg-card shadow-sm transition-transform hover:scale-110", done && "opacity-60")} style={{ borderColor: colorVar(it.color) }}>
                  {done ? <IconCheck size={12} style={{ color: colorVar(it.color) }} /> : <span className="size-2 rounded-full" style={{ background: colorVar(it.color) }} />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="relative mt-1 h-4 text-[11px] text-muted-foreground" aria-hidden="true">
        {[6, 9, 12, 15, 18, 21].map((h) => (
          <span key={h} className="absolute -translate-x-1/2" style={{ left: `${1 + pct(h * 60) * 98}%` }}>{h > 12 ? `${h - 12}pm` : h === 12 ? "12pm" : `${h}am`}</span>
        ))}
      </div>
      <ul className="mt-1 flex gap-2 overflow-x-auto no-scrollbar pb-1" aria-label="Scheduled items">
        {timed.map((it) => (
          <li key={it.key} className="shrink-0">
            <button onClick={() => onSelect?.(it)} className={cn("tap flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 text-xs", it.status === "done" && "line-through opacity-60")}>
              <span className="size-2 rounded-full" style={{ background: colorVar(it.color) }} aria-hidden="true" />
              <span className="tabular-nums text-muted-foreground">{it.start!.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
              <span className="max-w-56 truncate">{it.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** y (in viewBox units) for x along the bezier path above. */
function yOnPath(x: number): number {
  const t = (x - 10) / 980;
  const p = (a: number, b: number, c: number, d: number, tt: number) => (1 - tt) ** 3 * a + 3 * (1 - tt) ** 2 * tt * b + 3 * (1 - tt) * tt ** 2 * c + tt ** 3 * d;
  if (t <= 0.5) return p(70, 20, 110, 60, t * 2);
  return p(60, 10, 20, 70, (t - 0.5) * 2);
}
