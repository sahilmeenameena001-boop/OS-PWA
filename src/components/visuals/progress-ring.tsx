import { cn } from "@/lib/utils";

export function ProgressRing({ value, size = 64, stroke = 7, tone = "primary", label, children, className }: { value: number; size?: number; stroke?: number; tone?: "primary" | "mint" | "amber" | "coral"; label: string; children?: React.ReactNode; className?: string }) {
  const pct = Math.max(0, Math.min(1, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = { primary: "var(--primary)", mint: "var(--mint)", amber: "var(--amber)", coral: "var(--coral)" }[tone];
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }} role="img" aria-label={`${label}: ${Math.round(pct * 100)}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--muted)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset 600ms cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">{children ?? `${Math.round(pct * 100)}%`}</div>
    </div>
  );
}
