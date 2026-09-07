"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/data/db";
import { getSupabase } from "@/lib/supabase/client";
import { SUPABASE_CONFIGURED } from "@/lib/supabase/env";
import { fullSync, reconcileDeletes, type SyncState } from "@/lib/sync/engine";
import { DEMO_USER_ID } from "@/lib/ids";
import { ensureSeeded } from "@/lib/data/seed";
import type { Profile } from "@/lib/types";

interface SessionValue {
  userId: string;
  mode: "demo" | "cloud";
  email: string | null;
  ready: boolean;
  syncState: SyncState;
  pendingCount: number;
  lastSyncedAt: string | null;
  profile: Profile | null;
  syncNow: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children, initialUserId, initialEmail }: { children: ReactNode; initialUserId: string | null; initialEmail: string | null }) {
  const mode: "demo" | "cloud" = SUPABASE_CONFIGURED && initialUserId ? "cloud" : "demo";
  const userId = mode === "cloud" && initialUserId ? initialUserId : DEMO_USER_ID;
  const [ready, setReady] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>(mode === "demo" ? "local" : "idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const syncing = useRef(false);

  const pendingCount = useLiveQuery(() => getDB().outbox.where("status").anyOf("pending", "failed").count(), [], 0);
  const profile = useLiveQuery(() => getDB().profiles.where("user_id").equals(userId).first(), [userId]) ?? null;

  const syncNow = useCallback(async () => {
    if (mode !== "cloud" || syncing.current) return;
    const supabase = getSupabase();
    if (!supabase) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSyncState("offline");
      return;
    }
    syncing.current = true;
    setSyncState("syncing");
    try {
      await fullSync(supabase, userId);
      setSyncState("idle");
      setLastSyncedAt(new Date().toISOString());
    } catch {
      setSyncState("error");
    } finally {
      syncing.current = false;
    }
  }, [mode, userId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (mode === "demo") {
        await ensureSeeded(userId);
      } else {
        const supabase = getSupabase();
        if (supabase) {
          try {
            await fullSync(supabase, userId);
            await reconcileDeletes(supabase, userId);
            setLastSyncedAt(new Date().toISOString());
          } catch {
            setSyncState(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error");
          }
        }
        await ensureSeeded(userId, { onlyProfile: true });
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, userId]);

  useEffect(() => {
    if (mode !== "cloud") return;
    const onOnline = () => void syncNow();
    const onOffline = () => setSyncState("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const interval = window.setInterval(() => void syncNow(), 30_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(interval);
    };
  }, [mode, syncNow]);

  // Push whenever the outbox grows (debounced).
  useEffect(() => {
    if (mode !== "cloud" || !ready || pendingCount === 0) return;
    const t = window.setTimeout(() => void syncNow(), 800);
    return () => window.clearTimeout(t);
  }, [mode, ready, pendingCount, syncNow]);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
    window.location.href = "/login";
  }, []);

  const value = useMemo<SessionValue>(
    () => ({ userId, mode, email: initialEmail, ready, syncState, pendingCount, lastSyncedAt, profile, syncNow, signOut }),
    [userId, mode, initialEmail, ready, syncState, pendingCount, lastSyncedAt, profile, syncNow, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
