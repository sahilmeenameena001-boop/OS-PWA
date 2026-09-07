"use client";
import { useEffect, useState } from "react";
import type { DayItem } from "@/lib/schedule/day";
import { minutesSinceMidnight } from "@/lib/dates";
import { cn } from "@/lib/utils";

const START = 6 * 60;
const END = 23 * 60;
const SPAN = END - START;

/** Animated SVG day timeline: a drawn path from morning to night with items placed by time. */
export function DayTimeline({ items, isToday, onSelect }: { items: DayItem[]; isToday: boolean; onSelect?: (item: DayItem) => void }) {
  const [now, setNow] = useState(() => minutesSinceMidnight(new Date()));
  useEffect(() => {
    const id = window.setInterval(() => setNow(minutesSinceMidnight(new Date())), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const timed = items.filter((i) => i.start);
  const pos = (m: number) => Math.max(0, Math.min(1, (m - START) / SPAN)) * 100;
  const nowPct = pos(now);
  const colorVar = (c: DayItem["color"]) => `var(--${c})`;
  return (
    <div className="relative">
      <svg viewBox="0 0 1000 110" className="h-24 w-full md:h-28" role="img" aria-label={`Timeline with ${timed.length} scheduled items`}>
        <defs>
          <linearGradient id="tl-path" x1="0" x2="1">
            <stop offset="0" stopColor="var(--amber)" />
            <stop offset="0.5" stopColor="var(--primary)" />
            <stop offset="1" stopColor="var(--violet)" />
          </linearGradient>
        </defs>
        <path d="M10 70 C 200 20, 350 110, 500 60 S 800 20, 990 70" fill="none" stroke="var(--muted)" strokeWidth="6" strokeLinecap="round" />
        <path d="M10 70 C 200 20, 350 110, 500 60 S 800 20, 990 70" fill="none" stroke="url(#tl-path)" strokeWidth="6" strokeLinecap="round" className="anim-draw" />
        {[6, 9, 12, 15, 18, 21].map((h) => (
          <g key={h}>
            <text x={10 + (pos(h * 60) / 100) * 980} y="104" textAnchor="middle" fontSize="16" fill="currentColor" fillOpacity="0.55">{h > 12 ? `${h - 12}p` : h === 12 ? "12p" : `${h}a`}</text>
          </g>
        ))}
        {timed.map((it) => {
          const x = 10 + (pos(minutesSinceMidnight(it.start!)) / 100) * 980;
          const y = yOnPath(x);
          const done = it.status === "done";
          return (
            <g key={it.key} transform={`translate(${x} ${y})`} className="cursor-pointer" onClick={() => onSelect?.(it)} role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : -1} onKeyDown={(e) => e.key === "Enter" && onSelect?.(it)} aria-label={it.title}>
              <circle r="11" fill="var(--card)" stroke={colorVar(it.color)} strokeWidth="3" opacity={done ? 0.5 : 1} />
              {done ? <path d="M-5 0 L-1.5 3.5 L5 -3.5" stroke={colorVar(it.color)} strokeWidth="2.5" fill="none" strokeLinecap="round" /> : <circle r="4" fill={colorVar(it.color)} />}
            </g>
          );
        })}
        {isToday ? (
          <g transform={`translate(${10 + (nowPct / 100) * 980} ${yOnPath(10 + (nowPct / 100) * 980)})`}>
            <circle r="16" fill="var(--primary)" fillOpacity="0.18" />
            <circle r="6" fill="var(--primary)" />
          </g>
        ) : null}
      </svg>
      <ul className="mt-1 flex gap-2 overflow-x-auto no-scrollbar pb-1" aria-label="Scheduled items">
        {timed.map((it) => (
          <li key={it.key}>
            <button onClick={() => onSelect?.(it)} className={cn("tap flex shrink-0 items-center gap-2 rounded-full border border-border bg-card/70 px-3 text-xs", it.status === "done" && "line-through opacity-60")}>
              <span className="size-2 rounded-full" style={{ background: colorVar(it.color) }} aria-hidden="true" />
              <span className="tabular-nums text-muted-foreground">{it.start!.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
              <span className="max-w-40 truncate">{it.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Approximate y for x along the bezier path above (sampled). */
function yOnPath(x: number): number {
  const t = (x - 10) / 980;
  const p = (a: number, b: number, c: number, d: number, tt: number) => (1 - tt) ** 3 * a + 3 * (1 - tt) ** 2 * tt * b + 3 * (1 - tt) * tt ** 2 * c + tt ** 3 * d;
  if (t <= 0.5) return p(70, 20, 110, 60, t * 2);
  return p(60, 10, 20, 70, (t - 0.5) * 2);
}
