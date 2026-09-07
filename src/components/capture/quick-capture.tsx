"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useUI } from "@/store/ui";
import { useSession } from "@/lib/session/session-provider";
import { clearDraft, loadDraft, newDraft, saveCapture, saveDraft, type CaptureDraft } from "@/lib/capture/capture";
import { storeAttachment } from "@/lib/storage";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconCamera, IconCheck, IconLink, IconMic, IconFile } from "@/components/icons";
import { cn } from "@/lib/utils";

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>>; resultIndex: number }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type SpeechCtor = new () => SpeechRecognitionLike;

function getSpeechCtor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function QuickCapture() {
  const open = useUI((s) => s.captureOpen);
  const prefill = useUI((s) => s.capturePrefill);
  const close = useUI((s) => s.closeCapture);
  const announce = useUI((s) => s.announce);
  const { userId } = useSession();
  const [draft, setDraft] = useState<CaptureDraft>(() => newDraft());
  const [file, setFile] = useState<File | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const submittedRef = useRef<Set<string>>(new Set());
  const speechSupported = Boolean(getSpeechCtor());

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const d = await loadDraft();
      if (cancelled) return;
      const base = d && (d.content || d.url || d.scheduledFor) ? d : newDraft();
      setDraft(prefill ? { ...base, content: base.content ? `${base.content}\n${prefill}` : prefill } : base);
      setSaved(false);
      setFile(null);
      setShowMore(Boolean(base.url || base.scheduledFor));
    })();
    const t = window.setTimeout(() => textRef.current?.focus(), 80);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, prefill]);

  // Autosave the draft locally so nothing is lost if the sheet closes or the app reloads.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => void saveDraft({ ...draft, updatedAt: new Date().toISOString() }), 250);
    return () => window.clearTimeout(t);
  }, [draft, open]);

  const patch = (p: Partial<CaptureDraft>) => setDraft((d) => ({ ...d, ...p }));

  const toggleMic = () => {
    const Ctor = getSpeechCtor();
    if (!Ctor) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new Ctor();
    rec.lang = navigator.language || "en-IN";
    rec.interimResults = false;
    rec.continuous = true;
    rec.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0].transcript;
      if (text) setDraft((d) => ({ ...d, content: d.content ? `${d.content} ${text}` : text }));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const submit = useCallback(async () => {
    const content = draft.content.trim();
    if (!content && !draft.url.trim() && !file) {
      textRef.current?.focus();
      return;
    }
    if (saving || submittedRef.current.has(draft.clientId)) return;
    submittedRef.current.add(draft.clientId);
    setSaving(true);
    try {
      let attachmentId: string | null = null;
      let mime: string | null = null;
      if (file) {
        const att = await storeAttachment(userId, file, { kind: file.type.startsWith("image/") ? "photo" : "file", title: content.slice(0, 80) || file.name });
        attachmentId = att.id;
        mime = att.mime_type;
      }
      await saveCapture(userId, {
        clientId: draft.clientId,
        content: content || file?.name || draft.url,
        url: draft.url || null,
        attachmentId,
        attachmentMime: mime,
        scheduledFor: draft.scheduledFor ? new Date(draft.scheduledFor).toISOString() : null,
      });
      await clearDraft();
      setSaved(true);
      announce("Saved to inbox");
      toast.success("Saved to Inbox", { description: "Classify it whenever you like." });
      window.setTimeout(() => {
        close();
        setDraft(newDraft());
        setFile(null);
      }, 450);
    } catch (e) {
      submittedRef.current.delete(draft.clientId);
      toast.error("Could not save", { description: e instanceof Error ? e.message : "Your draft is kept locally." });
    } finally {
      setSaving(false);
    }
  }, [draft, file, saving, userId, announce, close]);

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? null : close())}>
      <SheetContent side="bottom" className="mx-auto max-h-[92dvh] w-full max-w-xl rounded-t-3xl p-0 md:bottom-4 md:rounded-3xl">
        <form
          className="flex flex-col gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <SheetHeader className="p-0">
            <SheetTitle>Quick capture</SheetTitle>
            <SheetDescription>Get it out of your head. Sort it later.</SheetDescription>
          </SheetHeader>
          <Label htmlFor="capture-text" className="sr-only">What do you want to remember?</Label>
          <Textarea
            id="capture-text"
            ref={textRef}
            value={draft.content}
            onChange={(e) => patch({ content: e.target.value })}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void submit();
            }}
            placeholder="Thought, task, expense, link…"
            rows={3}
            className="min-h-24 resize-none text-base"
            autoComplete="off"
          />
          <div className="flex flex-wrap items-center gap-2">
            {speechSupported ? (
              <Button type="button" variant={listening ? "default" : "outline"} size="icon" onClick={toggleMic} aria-pressed={listening} aria-label={listening ? "Stop listening" : "Speak"} className={cn(listening && "anim-pulse-ring")}>
                <IconMic size={18} />
              </Button>
            ) : null}
            <label className="tap inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm hover:bg-muted">
              <IconCamera size={18} />
              <span className="sr-only md:not-sr-only">Photo</span>
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <label className="tap inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm hover:bg-muted">
              <IconFile size={18} />
              <span className="sr-only md:not-sr-only">File</span>
              <input type="file" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <Button type="button" variant="outline" size="icon" aria-pressed={showMore} aria-label="Link and time" onClick={() => setShowMore((v) => !v)}>
              <IconLink size={18} />
            </Button>
            {file ? <span className="truncate text-xs text-muted-foreground">{file.name}</span> : null}
          </div>
          {showMore ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="capture-url">Link</Label>
                <Input id="capture-url" type="url" inputMode="url" placeholder="https://" value={draft.url} onChange={(e) => patch({ url: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="capture-when">Date and time (optional)</Label>
                <Input id="capture-when" type="datetime-local" value={draft.scheduledFor} onChange={(e) => patch({ scheduledFor: e.target.value })} />
              </div>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground" aria-live="polite">{saved ? "Saved" : "Draft autosaves locally"}</p>
            <Button type="submit" size="lg" disabled={saving || saved} className="min-w-28">
              {saved ? <><IconCheck size={18} /> Saved</> : saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
