"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { IconInstall, IconClose } from "@/components/icons";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa:install-dismissed";

/** Surfaces the browser install prompt once it is available; never blocks input. */
export function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      dismissed = false;
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
      if (!dismissed) setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  if (hidden || !evt) return null;
  return (
    <div role="dialog" aria-label="Install app" className="glass anim-rise fixed inset-x-4 bottom-24 z-40 flex items-center gap-3 rounded-2xl p-3 md:inset-x-auto md:right-8 md:bottom-28 md:w-80">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"><IconInstall size={22} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Install My Life OS</p>
        <p className="text-xs text-muted-foreground">Works offline, opens in one tap.</p>
      </div>
      <Button size="sm" onClick={async () => { await evt.prompt(); setHidden(true); }}>Install</Button>
      <button className="tap grid place-items-center rounded-lg text-muted-foreground" aria-label="Dismiss" onClick={() => { setHidden(true); try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ } }}>
        <IconClose size={16} />
      </button>
    </div>
  );
}
