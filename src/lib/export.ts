import { getDB } from "@/lib/data/db";
import { insert } from "@/lib/data/repo";
import { TABLE_NAMES, type BaseRecord, type TableMap, type TableName } from "@/lib/types";

export interface ExportBundle {
  app: "my-life-os";
  version: 1;
  exported_at: string;
  tables: { [K in TableName]?: TableMap[K][] };
}

export async function exportAll(userId: string): Promise<ExportBundle> {
  const db = getDB();
  const tables: ExportBundle["tables"] = {};
  for (const t of TABLE_NAMES) {
    const rows = await db.tbl(t).where("user_id").equals(userId).toArray();
    (tables as Record<string, unknown[]>)[t] = rows;
  }
  return { app: "my-life-os", version: 1, exported_at: new Date().toISOString(), tables };
}

export function downloadFile(name: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

const IMPORT_ORDER: TableName[] = TABLE_NAMES.filter((t) => t !== "profiles" && t !== "audit_events" && t !== "notification_preferences");

/** Imports a bundle as new records owned by the current user. Existing ids are kept when not already present. */
export async function importBundle(userId: string, bundle: ExportBundle): Promise<number> {
  if (bundle.app !== "my-life-os") throw new Error("Not a My Life OS export");
  const db = getDB();
  let n = 0;
  for (const t of IMPORT_ORDER) {
    const rows = (bundle.tables[t] ?? []) as (TableMap[typeof t] & BaseRecord)[];
    for (const r of rows) {
      const exists = await db.tbl(t).get(r.id);
      if (exists) continue;
      const { user_id: _u, created_at, updated_at: _up, ...rest } = r;
      void _u; void _up;
      await insert(t, userId, { ...(rest as Omit<TableMap[typeof t], keyof BaseRecord>), id: r.id, created_at });
      n++;
    }
  }
  return n;
}
