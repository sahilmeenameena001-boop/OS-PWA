"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/lib/session/session-provider";
import { useRows } from "@/lib/data/hooks";
import { storeAttachment, attachmentUrl, deleteAttachment, retryPendingUploads } from "@/lib/storage";
import { update } from "@/lib/data/repo";
import { formatDateHuman } from "@/lib/dates";
import { PageHeader, Panel, EmptyState, SkeletonRows, StatusPill, ConfirmDialog, Field } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IconUpload, IconFile, IconTrash, IconShield } from "@/components/icons";
import type { Attachment } from "@/lib/types";

function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function VaultPage() {
  const { userId, mode } = useSession();
  const rows = useRows("attachments");
  const [q, setQ] = useState("");
  const [viewing, setViewing] = useState<{ row: Attachment; url: string | null } | null>(null);
  const [del, setDel] = useState<Attachment | null>(null);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode === "cloud") void retryPendingUploads(userId);
  }, [mode, userId]);
  useEffect(() => () => { if (viewing?.url?.startsWith("blob:")) URL.revokeObjectURL(viewing.url); }, [viewing]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("Files up to 20 MB"); return; }
    setBusy(true);
    try {
      await storeAttachment(userId, file, { kind: file.type.startsWith("image/") ? "photo" : file.type === "application/pdf" ? "document" : "file", title: title.trim() || null, tags: tags.split(",").map((t) => t.trim()).filter(Boolean), isVault: true });
      toast.success(`${file.name} saved to vault`);
      setTitle(""); setTags("");
    } finally { setBusy(false); }
  };
  const open = async (row: Attachment) => setViewing({ row, url: await attachmentUrl(row) });
  const list = (rows ?? []).filter((r) => { const s = `${r.title ?? ""} ${r.file_name} ${r.tags.join(" ")} ${r.kind}`.toLowerCase(); return !q || s.includes(q.toLowerCase()); }).sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="space-y-4">
      <PageHeader title="Vault" subtitle={<span className="inline-flex items-center gap-1"><IconShield size={14} /> Private documents. {mode === "cloud" ? "Stored encrypted at rest in private storage with signed links." : "Local mode: files stay in this browser."}</span>} />
      <Panel title="Add a document">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Field label="Title" htmlFor="v-title"><Input id="v-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Passport scan" /></Field>
          <Field label="Tags" htmlFor="v-tags"><Input id="v-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="id, travel" /></Field>
          <div className="flex items-end"><label className="tap inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"><IconUpload size={18} /> {busy ? "Saving…" : "Choose file"}<input type="file" className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files?.[0])} /></label></div>
        </div>
      </Panel>
      <Panel title={`Documents (${list.length})`} action={<Input aria-label="Search vault" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-40" />}>
        {!rows ? <SkeletonRows /> : list.length === 0 ? <EmptyState icon={<IconFile size={28} />} title="Vault is empty" body="Receipts, IDs, prescriptions, contracts." /> : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {list.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <button onClick={() => open(r)} className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground" aria-label={`Open ${r.title ?? r.file_name}`}><IconFile size={20} /></button>
                <div className="min-w-0 flex-1">
                  <button onClick={() => open(r)} className="block w-full truncate text-left text-sm font-medium">{r.title ?? r.file_name}</button>
                  <p className="text-xs text-muted-foreground">{formatDateHuman(r.created_at.slice(0, 10))} · {bytes(r.size_bytes)} · {r.mime_type.split("/")[1] ?? r.mime_type}</p>
                  <p className="mt-0.5 flex flex-wrap gap-1">{r.tags.map((t) => <StatusPill key={t} tone="muted">{t}</StatusPill>)}{r.is_vault ? null : <StatusPill tone="primary">{r.kind}</StatusPill>}</p>
                </div>
                <Button size="icon-sm" variant="ghost" aria-label={`Delete ${r.file_name}`} onClick={() => setDel(r)}><IconTrash size={14} /></Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Dialog open={Boolean(viewing)} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{viewing?.row.title ?? viewing?.row.file_name}</DialogTitle><DialogDescription>{viewing?.row.file_name}</DialogDescription></DialogHeader>
          {/* eslint-disable-next-line @next/next/no-img-element -- blob/signed URLs cannot go through next/image */}
          {viewing?.url ? (viewing.row.mime_type.startsWith("image/") ? <img src={viewing.url} alt={viewing.row.title ?? viewing.row.file_name} className="max-h-[60vh] w-full rounded-xl object-contain" /> : viewing.row.mime_type === "application/pdf" ? <iframe src={viewing.url} title={viewing.row.file_name} className="h-[60vh] w-full rounded-xl" /> : <a href={viewing.url} download={viewing.row.file_name} className="text-primary underline">Download {viewing.row.file_name}</a>) : <p className="text-sm text-muted-foreground">File not available on this device yet. It will appear after sync.</p>}
          <Field label="Title" htmlFor="v-edit-title"><Input id="v-edit-title" defaultValue={viewing?.row.title ?? ""} onBlur={(e) => viewing && update("attachments", userId, viewing.row.id, { title: e.target.value.trim() || null })} /></Field>
          <DialogFooter><Button variant="outline" onClick={() => setViewing(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={Boolean(del)} onOpenChange={(o) => !o && setDel(null)} title="Delete this document permanently?" body="This removes the file from storage. There is no undo." confirmLabel="Delete" destructive requireText="DELETE" onConfirm={async () => { if (del) { await deleteAttachment(userId, del); toast("Deleted"); } }} />
    </div>
  );
}
