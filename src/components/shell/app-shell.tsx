"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useUI } from "@/store/ui";
import { useSession } from "@/lib/session/session-provider";
import { runNotificationTick } from "@/lib/notifications/scheduler";
import { IconCalendar, IconCapture, IconHabits, IconInbox, IconInsights, IconMemory, IconMoney, IconSavings, IconSettings, IconToday, IconVault, IconSearch } from "@/components/icons";
import { QuickCapture } from "@/components/capture/quick-capture";
import { QuickExpense } from "@/components/money/quick-expense";
import { NotificationCenter } from "@/components/shell/notification-center";
import { CommandPalette } from "@/components/shell/command-palette";
import { SyncStatus } from "@/components/shell/sync-status";
import { InstallPrompt } from "@/components/shell/install-prompt";
import { useRowsOr } from "@/lib/data/hooks";

const DESKTOP_NAV = [
  { href: "/", label: "Today", Icon: IconToday },
  { href: "/calendar", label: "Calendar", Icon: IconCalendar },
  { href: "/inbox", label: "Inbox", Icon: IconInbox },
  { href: "/money", label: "Money", Icon: IconMoney },
  { href: "/savings", label: "Savings", Icon: IconSavings },
  { href: "/habits", label: "Habits", Icon: IconHabits },
  { href: "/memory", label: "Memory", Icon: IconMemory },
  { href: "/vault", label: "Vault", Icon: IconVault },
  { href: "/insights", label: "Insights", Icon: IconInsights },
  { href: "/settings", label: "Settings", Icon: IconSettings },
];

const MOBILE_NAV = [
  { href: "/", label: "Today", Icon: IconToday },
  { href: "/calendar", label: "Calendar", Icon: IconCalendar },
  { href: "/capture", label: "Capture", Icon: IconCapture },
  { href: "/money", label: "Money", Icon: IconMoney },
  { href: "/memory", label: "Memory", Icon: IconMemory },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { userId, ready, profile } = useSession();
  const openCapture = useUI((s) => s.openCapture);
  const setPaletteOpen = useUI((s) => s.setPaletteOpen);
  const inbox = useRowsOr("inbox_items");
  const unprocessed = inbox.filter((i) => i.status === "unprocessed").length;

  useEffect(() => {
    if (ready && profile && !profile.onboarding_completed && pathname !== "/onboarding") router.replace("/onboarding");
  }, [ready, profile, pathname, router]);

  useEffect(() => {
    if (!ready) return;
    let stopped = false;
    const tick = () => {
      if (!stopped) void runNotificationTick(userId);
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [ready, userId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (!typing && e.key.toLowerCase() === "c" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        openCapture();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openCapture, setPaletteOpen]);

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only sr-only-focusable">Skip to content</a>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-sidebar/80 backdrop-blur-xl md:flex" aria-label="Primary">
        <div className="flex items-center gap-2 px-5 pt-5 pb-4">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lift">
            <IconToday size={20} />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">My Life OS</p>
            <p className="text-xs text-muted-foreground">Personal command centre</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3" aria-label="Sections">
          {DESKTOP_NAV.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("tap flex items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors", active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                <Icon size={18} />
                <span className="flex-1">{label}</span>
                {href === "/inbox" && unprocessed > 0 ? <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">{unprocessed}</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-2 p-3">
          <button onClick={() => setPaletteOpen(true)} className="tap flex w-full items-center gap-2 rounded-xl border border-border px-3 text-sm text-muted-foreground hover:bg-muted">
            <IconSearch size={16} /> Search <kbd className="ml-auto rounded bg-muted px-1.5 text-[10px]">⌘K</kbd>
          </button>
          <SyncStatus />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-background/70 px-4 py-2 backdrop-blur-xl md:hidden">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"><IconToday size={16} /></span>
            My Life OS
          </Link>
          <div className="flex items-center gap-1">
            <SyncStatus compact />
            <button onClick={() => setPaletteOpen(true)} className="tap grid place-items-center rounded-xl text-muted-foreground hover:bg-muted" aria-label="Search">
              <IconSearch size={20} />
            </button>
            <NotificationCenter />
          </div>
        </header>
        <div className="hidden items-center justify-end gap-2 px-6 pt-4 md:flex">
          <NotificationCenter />
        </div>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-4 md:px-6 md:pb-10" tabIndex={-1}>
          {children}
        </main>
      </div>

      {/* Persistent Quick Capture: one tap from every screen */}
      <button onClick={() => openCapture()} className="press anim-pulse-ring fixed right-4 bottom-24 z-40 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lift md:right-8 md:bottom-8" aria-label="Quick capture (shortcut C)">
        <IconCapture size={26} />
      </button>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden" aria-label="Primary">
        <ul className="grid grid-cols-5">
          {MOBILE_NAV.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            const isCapture = href === "/capture";
            return (
              <li key={href}>
                {isCapture ? (
                  <button onClick={() => openCapture()} className="tap flex w-full flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium text-primary" aria-label="Capture">
                    <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground"><Icon size={18} /></span>
                    {label}
                  </button>
                ) : (
                  <Link href={href} aria-current={active ? "page" : undefined} className={cn("tap flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
                    <Icon size={22} />
                    {label}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <QuickCapture />
      <QuickExpense />
      <CommandPalette />
      <InstallPrompt />
    </div>
  );
}
