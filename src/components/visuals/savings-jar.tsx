import { cn } from "@/lib/utils";

/** Animated SVG savings jar. Fill level = saved / target. */
export function SavingsJar({ value, label, size = 120, tone = "mint", className }: { value: number; label: string; size?: number; tone?: "mint" | "primary" | "amber"; className?: string }) {
  const pct = Math.max(0, Math.min(1, value));
  const color = { mint: "var(--mint)", primary: "var(--primary)", amber: "var(--amber)" }[tone];
  const jarTop = 34;
  const jarBottom = 118;
  const level = jarBottom - (jarBottom - jarTop) * pct;
  const id = `jar-${tone}`;
  return (
    <svg width={size} height={size} viewBox="0 0 120 130" className={cn("shrink-0", className)} role="img" aria-label={`${label}: ${Math.round(pct * 100)}% saved`}>
      <defs>
        <clipPath id={`${id}-clip`}>
          <path d="M28 34h64v72a12 12 0 0 1-12 12H40a12 12 0 0 1-12-12V34Z" />
        </clipPath>
        <linearGradient id={`${id}-liquid`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.95" />
          <stop offset="1" stopColor={color} stopOpacity="0.65" />
        </linearGradient>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="white" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="white" stopOpacity="0.04" />
          <stop offset="1" stopColor="white" stopOpacity="0.18" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="122" rx="34" ry="5" fill="black" fillOpacity="0.15" />
      <g clipPath={`url(#${id}-clip)`}>
        <rect x="28" y={level} width="64" height={jarBottom - level + 4} fill={`url(#${id}-liquid)`} style={{ transition: "y 800ms cubic-bezier(.2,.8,.2,1), height 800ms cubic-bezier(.2,.8,.2,1)" }} />
        <g className="anim-wave" style={{ transformOrigin: "0 0" }}>
          <path d={`M28 ${level} q16 -6 32 0 t32 0 t32 0 t32 0 v10 h-128 z`} fill={color} fillOpacity="0.5" style={{ transition: "d 800ms" }} />
        </g>
        <circle cx="48" cy={Math.min(level + 30, 110)} r="2.5" fill="white" fillOpacity="0.35" />
        <circle cx="72" cy={Math.min(level + 46, 112)} r="1.8" fill="white" fillOpacity="0.3" />
      </g>
      <path d="M28 34h64v72a12 12 0 0 1-12 12H40a12 12 0 0 1-12-12V34Z" fill={`url(#${id}-glass)`} stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" />
      <rect x="24" y="20" width="72" height="14" rx="5" fill="var(--card)" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" />
      <rect x="34" y="12" width="52" height="8" rx="3" fill="var(--card)" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" />
      <path d="M36 44v50" stroke="white" strokeOpacity="0.25" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
