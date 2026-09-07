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
import { SegmentedControl } from "@/components/common";
import Link from "next/link";

type Mode = "signin" | "signup" | "magic";

function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const next = params.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<Mode>("signin");
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
      const origin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` } });
        if (error) throw error;
        setMessage("Link sent. Open the email on this device and tap the link to sign in.");
        return;
      }
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${origin}/auth/callback` } });
        if (error) throw error;
        if (data.session) {
          router.replace("/onboarding");
          router.refresh();
          return;
        }
        setMessage("Account created. Check your email for a confirmation link, then come back and sign in.");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message === "Invalid login credentials" ? "Email or password is wrong. New here? Switch to Create account." : error.message);
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!SUPABASE_CONFIGURED) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">This copy of the app keeps everything on this device only. No account needed.</p>
        <Link href="/" className="tap inline-flex items-center justify-center rounded-xl bg-primary px-5 font-medium text-primary-foreground">Start using it</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <SegmentedControl value={mode === "magic" ? "signin" : mode} onChange={(v) => setMode(v)} ariaLabel="Sign in or create account" options={[{ value: "signin", label: "Sign in" }, { value: "signup", label: "Create account" }]} />
      <p className="text-sm text-muted-foreground">
        {mode === "signup" ? "First time here? Create your own private account. Your data is visible only to you." : mode === "magic" ? "We'll email you a one-tap link. No password needed." : "Welcome back. Use the email and password you signed up with."}
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {mode !== "magic" ? (
        <div className="space-y-1.5">
          <Label htmlFor="password">{mode === "signup" ? "Choose a password" : "Password"}</Label>
          <Input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={8} placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
      ) : null}
      {error ? <p role="alert" className="rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p> : null}
      {message ? <p role="status" className="rounded-lg bg-mint/10 px-3 py-2 text-sm text-mint">{message}</p> : null}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? "Please wait…" : mode === "signup" ? "Create my account" : mode === "magic" ? "Email me a sign-in link" : "Sign in"}
      </Button>
      {mode !== "signup" ? (
        <button type="button" className="tap w-full text-sm text-primary" onClick={() => setMode((m) => (m === "magic" ? "signin" : "magic"))}>
          {mode === "magic" ? "Use a password instead" : "Forgot password? Email me a sign-in link"}
        </button>
      ) : null}
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-sm">
        <CompassHero size={200} />
        <h1 className="mt-4 text-center text-2xl font-semibold">My Life OS</h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">Your day, money, habits and memory in one calm place.</p>
        <div className="glass rounded-3xl p-6">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
        <ul className="mt-5 space-y-1 text-center text-xs text-muted-foreground">
          <li>Works offline and installs like an app on your phone.</li>
          <li>Each account is private. Nobody else on the team can see your data.</li>
        </ul>
      </div>
    </main>
  );
}
