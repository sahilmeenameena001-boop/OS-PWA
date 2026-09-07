const formatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(amount: number, currency = "INR", opts: { compact?: boolean } = {}): string {
  const key = `${currency}:${opts.compact ? "c" : "f"}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: opts.compact ? 0 : 2,
      minimumFractionDigits: 0,
      notation: opts.compact && Math.abs(amount) >= 100000 ? "compact" : "standard",
    });
    formatters.set(key, f);
  }
  return f.format(amount);
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

export function truncate(s: string, n = 80): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
