"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/data/db";
import { useSession } from "@/lib/session/session-provider";
import type { TableMap, TableName } from "@/lib/types";

const EMPTY: never[] = [];

/** Live, user-scoped rows for a table. Returns undefined while loading. */
export function useRows<K extends TableName>(table: K, deps: unknown[] = []): TableMap[K][] | undefined {
  const { userId } = useSession();
  return useLiveQuery(() => getDB().tbl(table).where("user_id").equals(userId).toArray(), [userId, table, ...deps]);
}

export function useRowsOr<K extends TableName>(table: K): TableMap[K][] {
  return useRows(table) ?? (EMPTY as TableMap[K][]);
}

export function useRow<K extends TableName>(table: K, id: string | null | undefined): TableMap[K] | null | undefined {
  const { userId } = useSession();
  return useLiveQuery(async () => {
    if (!id) return null;
    const r = await getDB().tbl(table).get(id);
    return r && r.user_id === userId ? r : null;
  }, [table, id, userId]);
}

export function useProfile() {
  const { profile } = useSession();
  return profile;
}

export function useCurrency(): string {
  return useProfile()?.currency ?? "INR";
}

export function useCategoryMap(): Map<string, TableMap["expense_categories"]> {
  const cats = useRowsOr("expense_categories");
  return new Map(cats.map((c) => [c.id, c]));
}

export function useAccountMap(): Map<string, TableMap["accounts"]> {
  const accounts = useRowsOr("accounts");
  return new Map(accounts.map((a) => [a.id, a]));
}
