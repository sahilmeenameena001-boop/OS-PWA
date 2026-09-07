"use client";
import { useSession } from "@/lib/session/session-provider";
import { IconCloud, IconCloudOff, IconRefresh } from "@/components/icons";
import { cn } from "@/lib/utils";

export function SyncStatus({ compact }: { compact?: boolean }) {
  const { mode, syncState, pendingCount, syncNow } = useSession();
  const label =
    mode === "demo"
      ? "Local only"
      : syncState === "offline"
        ? `Offline · ${pendingCount} pending`
        : syncState === "syncing"
          ? "Syncing…"
          : syncState === "error"
            ? `Sync failed · ${pendingCount} pending`
            : pendingCount > 0
              ? `${pendingCount} pending`
              : "Synced";
  const tone = syncState === "error" ? "text-coral" : syncState === "offline" ? "text-amber" : pendingCount > 0 ? "text-amber" : "text-mint";
  const Icon = syncState === "offline" ? IconCloudOff : syncState === "syncing" ? IconRefresh : IconCloud;
  if (compact) {
    return (
      <button onClick={() => void syncNow()} className={cn("tap grid place-items-center rounded-xl", tone)} aria-label={label} title={label}>
        <Icon size={20} className={syncState === "syncing" ? "animate-spin" : undefined} />
      </button>
    );
  }
  return (
    <button onClick={() => void syncNow()} className={cn("tap flex w-full items-center gap-2 rounded-xl px-3 text-xs hover:bg-muted", tone)} aria-live="polite">
      <Icon size={16} className={syncState === "syncing" ? "animate-spin" : undefined} />
      <span>{label}</span>
      {mode === "cloud" ? <span className="ml-auto text-muted-foreground">tap to sync</span> : null}
    </button>
  );
}
