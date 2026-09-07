"use client";
import { useUI } from "@/store/ui";
import { useRowsOr } from "@/lib/data/hooks";
import { useSession } from "@/lib/session/session-provider";
import { update } from "@/lib/data/repo";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { IconBell } from "@/components/icons";
import { EmptyState, StatusPill } from "@/components/common";
import { formatDistanceToNow, parseISO } from "date-fns";
import type { AppNotification } from "@/lib/types";

export function NotificationCenter() {
  const open = useUI((s) => s.notificationsOpen);
  const setOpen = useUI((s) => s.setNotificationsOpen);
  const { userId } = useSession();
  const all = useRowsOr("notifications");
  const items = all.slice().sort((a, b) => b.fire_at.localeCompare(a.fire_at)).slice(0, 60);
  const unread = all.filter((n) => n.status === "unread").length;
  const persistent = all.filter((n) => n.level === "persistent" && n.status !== "acknowledged");

  const mark = (n: AppNotification, status: AppNotification["status"]) => update("notifications", userId, n.id, { status });
  const markAllRead = async () => {
    for (const n of all) if (n.status === "unread" && n.level !== "persistent") await mark(n, "read");
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="tap relative grid place-items-center rounded-xl text-muted-foreground hover:bg-muted" aria-label={`Notifications, ${unread} unread`}>
        <IconBell size={20} />
        {unread > 0 ? <span className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-coral px-1 text-[10px] font-bold text-coral-foreground">{unread}</span> : null}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border p-4">
            <SheetTitle>Notifications</SheetTitle>
            <SheetDescription>Gentle, important, and persistent items. Persistent ones stay until you acknowledge them.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-3">
            {persistent.length > 0 ? (
              <div className="mb-3 space-y-2">
                {persistent.map((n) => (
                  <div key={n.id} className="rounded-xl border border-coral/40 bg-coral/10 p-3">
                    <p className="font-medium">{n.title}</p>
                    {n.body ? <p className="text-sm text-muted-foreground">{n.body}</p> : null}
                    <Button size="sm" className="mt-2" onClick={() => mark(n, "acknowledged")}>Acknowledge</Button>
                  </div>
                ))}
              </div>
            ) : null}
            {items.length === 0 ? (
              <EmptyState title="All quiet" body="Reminders and due items will appear here." />
            ) : (
              <ul className="space-y-1">
                {items.filter((n) => !(n.level === "persistent" && n.status !== "acknowledged")).map((n) => (
                  <li key={n.id}>
                    <button onClick={() => mark(n, n.status === "unread" ? "read" : "unread")} className="flex w-full flex-col items-start gap-1 rounded-xl px-3 py-2 text-left hover:bg-muted" aria-pressed={n.status !== "unread"}>
                      <div className="flex w-full items-center gap-2">
                        <span className={n.status === "unread" ? "size-2 rounded-full bg-primary" : "size-2 rounded-full bg-transparent"} aria-hidden="true" />
                        <span className={n.status === "unread" ? "font-medium" : "text-muted-foreground"}>{n.title}</span>
                        <StatusPill tone={n.level === "important" ? "amber" : n.level === "persistent" ? "coral" : "muted"} className="ml-auto">{n.level}</StatusPill>
                      </div>
                      {n.body ? <span className="pl-4 text-sm text-muted-foreground">{n.body}</span> : null}
                      <span className="pl-4 text-xs text-muted-foreground">{formatDistanceToNow(parseISO(n.fire_at), { addSuffix: true })}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-border p-3">
            <Button variant="outline" className="w-full" onClick={markAllRead} disabled={unread === 0}>Mark all as read</Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
