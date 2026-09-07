"use client";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export function PageHeader({ title, subtitle, actions, className }: { title: string; subtitle?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <header className={cn("mb-5 flex flex-wrap items-end justify-between gap-3", className)}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="-mx-4 flex w-[calc(100%+2rem)] items-center gap-2 overflow-x-auto px-4 no-scrollbar md:mx-0 md:w-auto md:flex-wrap md:overflow-visible md:px-0 [&>*]:shrink-0">{actions}</div> : null}
    </header>
  );
}

export function Panel({ children, className, title, action, as: Tag = "section", ...rest }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; as?: "section" | "div" | "article" } & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cn("glass rounded-2xl p-4 md:p-5", className)} {...rest}>
      {title ? (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </Tag>
  );
}

export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-4 py-8 text-center", className)}>
      {icon ? <div className="mb-3 text-muted-foreground">{icon}</div> : null}
      <p className="font-medium">{title}</p>
      {body ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Stat({ label, value, hint, tone = "default", className }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "default" | "mint" | "amber" | "coral" | "primary"; className?: string }) {
  const tones = { default: "", mint: "text-mint", amber: "text-amber", coral: "text-coral", primary: "text-primary" };
  return (
    <div className={cn("rounded-xl bg-muted/50 p-3", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-lg font-semibold tabular-nums", tones[tone])}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function StatusPill({ tone, children, className }: { tone: "mint" | "amber" | "coral" | "primary" | "muted"; children: ReactNode; className?: string }) {
  const map = {
    mint: "bg-mint/15 text-mint",
    amber: "bg-amber/15 text-amber",
    coral: "bg-coral/15 text-coral",
    primary: "bg-primary/15 text-primary",
    muted: "bg-muted text-muted-foreground",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", map[tone], className)}>{children}</span>;
}

export function Field({ label, htmlFor, hint, children, className }: { label: string; htmlFor: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function ConfirmDialog({ open, onOpenChange, title, body, confirmLabel = "Confirm", destructive, onConfirm, requireText }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; body?: string; confirmLabel?: string; destructive?: boolean; onConfirm: () => void | Promise<void>; requireText?: string }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = !requireText || typed === requireText;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) { onOpenChange(o); setTyped(""); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {body ? <DialogDescription>{body}</DialogDescription> : null}
        </DialogHeader>
        {requireText ? (
          <div className="space-y-1.5">
            <Label htmlFor="confirm-text">Type <span className="font-mono">{requireText}</span> to continue</Label>
            <input id="confirm-text" className="tap w-full rounded-lg border border-input bg-background px-3" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant={destructive ? "destructive" : "default"} disabled={!ok || busy} onClick={async () => { setBusy(true); try { await onConfirm(); onOpenChange(false); } finally { setBusy(false); setTyped(""); } }}>
            {busy ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SkeletonRows({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-11 rounded-xl" />
      ))}
    </div>
  );
}

export function SegmentedControl<T extends string>({ value, onChange, options, ariaLabel }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; ariaLabel: string }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex w-full max-w-full overflow-x-auto no-scrollbar rounded-xl bg-muted p-1 md:inline-flex md:w-auto">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)} className={cn("tap shrink-0 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors", value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
