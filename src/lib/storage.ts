"use client";
import { getDB } from "@/lib/data/db";
import { insert, remove } from "@/lib/data/repo";
import { getSupabase } from "@/lib/supabase/client";
import { newId } from "@/lib/ids";
import type { Attachment, AttachmentKind } from "@/lib/types";

/**
 * Attachments: metadata row in `attachments`; bytes in private Supabase Storage under
 * `<user_id>/<id>-<name>` (signed URLs), with a local IndexedDB blob cache so offline
 * uploads are never lost. Demo mode keeps files local only.
 */
const BLOB_PREFIX = "blob:";

export async function storeAttachment(userId: string, file: File, opts: { kind: AttachmentKind; title?: string | null; tags?: string[]; linkedType?: string | null; linkedId?: string | null; isVault?: boolean }): Promise<Attachment> {
  const id = newId();
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 80);
  const path = `${userId}/${id}-${safeName}`;
  await getDB().kv.put({ key: BLOB_PREFIX + id, value: file });
  const row = await insert("attachments", userId, {
    id,
    bucket: "private",
    storage_path: path,
    file_name: file.name,
    mime_type: file.type || "application/octet-stream",
    size_bytes: file.size,
    kind: opts.kind,
    title: opts.title ?? null,
    tags: opts.tags ?? [],
    linked_type: opts.linkedType ?? null,
    linked_id: opts.linkedId ?? null,
    is_vault: opts.isVault ?? false,
  });
  void uploadPending(id);
  return row;
}

/** Push a locally cached blob to storage; safe to retry. */
export async function uploadPending(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const db = getDB();
  const [row, blobRow] = await Promise.all([db.attachments.get(id), db.kv.get(BLOB_PREFIX + id)]);
  const blob = blobRow?.value;
  if (!row || !(blob instanceof Blob)) return false;
  const { error } = await supabase.storage.from(row.bucket).upload(row.storage_path, blob, { upsert: true, contentType: row.mime_type });
  if (error) return false;
  await db.kv.put({ key: `uploaded:${id}`, value: true });
  return true;
}

export async function retryPendingUploads(userId: string): Promise<void> {
  const db = getDB();
  const rows = await db.attachments.where("user_id").equals(userId).toArray();
  for (const r of rows) {
    const done = await db.kv.get(`uploaded:${r.id}`);
    if (!done) await uploadPending(r.id);
  }
}

/** Object URL for viewing: local blob first, otherwise a 1-hour signed URL. Caller revokes object URLs. */
export async function attachmentUrl(row: Attachment): Promise<string | null> {
  const blobRow = await getDB().kv.get(BLOB_PREFIX + row.id);
  if (blobRow?.value instanceof Blob) return URL.createObjectURL(blobRow.value);
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.storage.from(row.bucket).createSignedUrl(row.storage_path, 3600);
  return data?.signedUrl ?? null;
}

export async function deleteAttachment(userId: string, row: Attachment): Promise<void> {
  const supabase = getSupabase();
  if (supabase) await supabase.storage.from(row.bucket).remove([row.storage_path]);
  await getDB().kv.delete(BLOB_PREFIX + row.id);
  await getDB().kv.delete(`uploaded:${row.id}`);
  await remove("attachments", userId, row.id);
}
