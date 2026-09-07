"use client";
import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { SUPABASE_CONFIGURED } from "@/lib/supabase/env";
import { CompassHero } from "@/components/visuals/compass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const next = params.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "magic") {
        const origin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` } });
        if (error) throw error;
        setMessage("Check your email for a sign-in link.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const { error: signUpError } = await supabase.auth.signUp({ email, password });
          if (signUpError) throw error;
          setMessage("Account created. If email confirmation is on, check your inbox; otherwise you are signed in.");
        }
        router.replace(next);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  if (!SUPABASE_CONFIGURED) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">Supabase is not configured, so the app runs in local demo mode. Your data stays in this browser.</p>
        <Link href="/" className="tap inline-flex items-center justify-center rounded-xl bg-primary px-5 font-medium text-primary-foreground">Continue locally</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {mode === "password" ? (
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="text-xs text-muted-foreground">New here? Entering a new email and password creates your account.</p>
        </div>
      ) : null}
      {error ? <p role="alert" className="rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p> : null}
      {message ? <p role="status" className="rounded-lg bg-mint/10 px-3 py-2 text-sm text-mint">{message}</p> : null}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? "Please wait…" : mode === "magic" ? "Send magic link" : "Continue"}
      </Button>
      <button type="button" className="tap w-full text-sm text-primary" onClick={() => setMode((m) => (m === "magic" ? "password" : "magic"))}>
        {mode === "magic" ? "Use a password instead" : "Email me a magic link instead"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-sm">
        <CompassHero size={200} />
        <h1 className="mt-4 text-center text-2xl font-semibold">My Life OS</h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">One calm place for today, money, and memory.</p>
        <div className="glass rounded-3xl p-6">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
