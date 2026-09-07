"use client";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { useSession } from "@/lib/session/session-provider";
import { useRowsOr, useCurrency, useProfile } from "@/lib/data/hooks";
import { update } from "@/lib/data/repo";
import { exportAll, downloadFile, importBundle, type ExportBundle } from "@/lib/export";
import { transactionsToCsv, deleteAllForUser } from "@/lib/money/ledger";
import { requestBrowserPermission } from "@/lib/notifications/scheduler";
import { getSupabase } from "@/lib/supabase/client";
import { todayKey } from "@/lib/dates";
import { PageHeader, Panel, Field, ConfirmDialog, SegmentedControl } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { IconDownload, IconUpload, IconLogout, IconTrash, IconSun, IconMoon } from "@/components/icons";

export default function SettingsPage() {
  const { userId, mode, email, signOut, syncNow, syncState, pendingCount } = useSession();
  const profile = useProfile();
  const currency = useCurrency();
  const prefs = useRowsOr("notification_preferences")[0] ?? null;
  const transactions = useRowsOr("transactions");
  const categories = useRowsOr("expense_categories");
  const accounts = useRowsOr("accounts");
  const { theme, setTheme } = useTheme();
  const [f, setF] = useState({ display_name: "", monthly_income: "", income_day: "1", opening_balance: "", protected_savings_min: "", daily_limit: "", weekly_limit: "", currency: "INR" });
  const [delOpen, setDelOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (profile) setF({ display_name: profile.display_name ?? "", monthly_income: String(profile.monthly_income), income_day: String(profile.income_day), opening_balance: String(profile.opening_balance), protected_savings_min: String(profile.protected_savings_min), daily_limit: profile.daily_limit != null ? String(profile.daily_limit) : "", weekly_limit: profile.weekly_limit != null ? String(profile.weekly_limit) : "", currency: profile.currency });
  }, [profile]);
  useEffect(() => { setPermission(typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"); }, []);

  const saveProfile = async () => {
    await update("profiles", userId, userId, { display_name: f.display_name.trim() || null, monthly_income: Number(f.monthly_income) || 0, income_day: Math.min(28, Math.max(1, Number(f.income_day) || 1)), opening_balance: Number(f.opening_balance) || 0, protected_savings_min: Number(f.protected_savings_min) || 0, daily_limit: f.daily_limit ? Number(f.daily_limit) : null, weekly_limit: f.weekly_limit ? Number(f.weekly_limit) : null, currency: f.currency || "INR" });
    toast.success("Profile saved");
  };
  const setPref = async (patch: Partial<NonNullable<typeof prefs>>) => { if (prefs) await update("notification_preferences", userId, prefs.id, patch); };
  const enableBrowser = async () => {
    const p = await requestBrowserPermission();
    setPermission(p);
    await setPref({ browser_enabled: p === "granted" });
    toast(p === "granted" ? "Browser notifications on" : "Permission not granted. The in-app centre still works.");
  };
  const exportJson = async () => { const b = await exportAll(userId); downloadFile(`my-life-os-${todayKey()}.json`, JSON.stringify(b, null, 2), "application/json"); };
  const exportCsv = () => downloadFile(`transactions-${todayKey()}.csv`, transactionsToCsv(transactions, new Map(categories.map((c) => [c.id, c.name])), new Map(accounts.map((a) => [a.id, a.name]))), "text/csv");
  const importJson = async (file: File | undefined) => {
    if (!file) return;
    try { const n = await importBundle(userId, JSON.parse(await file.text()) as ExportBundle); toast.success(`Imported ${n} records`); } catch (e) { toast.error(e instanceof Error ? e.message : "Import failed"); }
  };
  const deleteEverything = async () => {
    const supabase = getSupabase();
    if (supabase && mode === "cloud") { const { error } = await supabase.rpc("delete_my_data"); if (error) throw new Error(error.message); }
    await deleteAllForUser(userId);
    toast.success("All data deleted");
    window.location.href = mode === "cloud" ? "/login" : "/";
    if (supabase) await supabase.auth.signOut();
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" subtitle={mode === "cloud" ? `Signed in as ${email}` : "Local demo mode. Add Supabase keys to sync across devices."} actions={mode === "cloud" ? <Button variant="outline" size="sm" onClick={signOut}><IconLogout size={16} /> Sign out</Button> : undefined} />
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Appearance">
          <SegmentedControl value={(theme as "system" | "light" | "dark") ?? "system"} onChange={(v) => { setTheme(v); void update("profiles", userId, userId, { theme: v }); }} ariaLabel="Theme" options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><IconSun size={14} /> Ivory by day <IconMoon size={14} /> midnight by night. Animations follow your reduced-motion setting.</p>
        </Panel>
        <Panel title="Sync">
          <p className="text-sm">{mode === "cloud" ? `Status: ${syncState}${pendingCount ? ` · ${pendingCount} pending` : ""}` : "All data is stored in this browser's IndexedDB."}</p>
          {mode === "cloud" ? <Button size="sm" variant="outline" className="mt-2" onClick={() => void syncNow()}>Sync now</Button> : null}
        </Panel>
      </div>
      <Panel title="Profile and money setup">
        <form onSubmit={(e) => { e.preventDefault(); void saveProfile(); }} className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <Field label="Name" htmlFor="s-name"><Input id="s-name" value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></Field>
          <Field label="Currency" htmlFor="s-currency"><Input id="s-currency" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase().slice(0, 3) })} /></Field>
          <Field label="Monthly income" htmlFor="s-income"><Input id="s-income" type="number" min={0} value={f.monthly_income} onChange={(e) => setF({ ...f, monthly_income: e.target.value })} /></Field>
          <Field label="Income day" htmlFor="s-day" hint="Starts your budget period"><Input id="s-day" type="number" min={1} max={28} value={f.income_day} onChange={(e) => setF({ ...f, income_day: e.target.value })} /></Field>
          <Field label="Opening balance" htmlFor="s-opening"><Input id="s-opening" type="number" value={f.opening_balance} onChange={(e) => setF({ ...f, opening_balance: e.target.value })} /></Field>
          <Field label="Minimum protected savings" htmlFor="s-protected"><Input id="s-protected" type="number" min={0} value={f.protected_savings_min} onChange={(e) => setF({ ...f, protected_savings_min: e.target.value })} /></Field>
          <Field label="Daily limit (optional)" htmlFor="s-daily"><Input id="s-daily" type="number" min={0} value={f.daily_limit} onChange={(e) => setF({ ...f, daily_limit: e.target.value })} /></Field>
          <Field label="Weekly limit (optional)" htmlFor="s-weekly"><Input id="s-weekly" type="number" min={0} value={f.weekly_limit} onChange={(e) => setF({ ...f, weekly_limit: e.target.value })} /></Field>
          <div className="sm:col-span-2 md:col-span-4"><Button type="submit">Save</Button></div>
        </form>
      </Panel>
      <Panel title="Notifications">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">Browser notifications</p><p className="text-xs text-muted-foreground">{permission === "unsupported" ? "Not supported in this browser" : permission === "granted" ? "Allowed" : permission === "denied" ? "Blocked in browser settings" : "Ask for permission"}</p></div>{permission === "granted" ? <Switch checked={prefs?.browser_enabled ?? false} onCheckedChange={(v) => setPref({ browser_enabled: v })} aria-label="Browser notifications" /> : <Button size="sm" variant="outline" disabled={permission === "unsupported" || permission === "denied"} onClick={enableBrowser}>Enable</Button>}</div>
          {(["gentle", "important", "persistent"] as const).map((lvl) => <div key={lvl} className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium capitalize">{lvl}</p><p className="text-xs text-muted-foreground">{lvl === "gentle" ? "Quiet nudges" : lvl === "important" ? "Time-sensitive items" : "Stays until you acknowledge it"}</p></div><Switch checked={prefs?.[`${lvl}_enabled`] ?? true} onCheckedChange={(v) => setPref({ [`${lvl}_enabled`]: v })} aria-label={`${lvl} notifications`} /></div>)}
          <div className="grid grid-cols-2 gap-3"><Field label="Quiet hours start" htmlFor="q-start"><Input id="q-start" type="time" value={prefs?.quiet_hours_start ?? ""} onChange={(e) => setPref({ quiet_hours_start: e.target.value || null })} /></Field><Field label="Quiet hours end" htmlFor="q-end"><Input id="q-end" type="time" value={prefs?.quiet_hours_end ?? ""} onChange={(e) => setPref({ quiet_hours_end: e.target.value || null })} /></Field></div>
        </div>
      </Panel>
      <Panel title="Backup and export">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportJson}><IconDownload size={16} /> Export everything (JSON)</Button>
          <Button variant="outline" onClick={exportCsv}><IconDownload size={16} /> Transactions (CSV)</Button>
          <label className="tap inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted"><IconUpload size={16} /> Import JSON<input type="file" accept="application/json" className="sr-only" onChange={(e) => importJson(e.target.files?.[0])} /></label>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Exports include all tables in {currency}. Imports add records that are not already present.</p>
      </Panel>
      <Panel title="How this app works">
        <ol className="grid gap-2 text-sm sm:grid-cols-2">
          <li className="rounded-xl bg-muted/50 p-3"><p className="font-medium">1. Capture first, sort later</p><p className="text-xs text-muted-foreground">The + button saves anything instantly to the Inbox. Turn it into a task, expense, note or reminder when you have a moment.</p></li>
          <li className="rounded-xl bg-muted/50 p-3"><p className="font-medium">2. Today shows what matters now</p><p className="text-xs text-muted-foreground">Your timeline, top 3 priorities, essential habits, bills due and how much is safe to spend.</p></li>
          <li className="rounded-xl bg-muted/50 p-3"><p className="font-medium">3. Money is simple arithmetic</p><p className="text-xs text-muted-foreground">Income + balance, minus protected savings, unpaid bills and debts, minus what you have spent, divided by days left in the month.</p></li>
          <li className="rounded-xl bg-muted/50 p-3"><p className="font-medium">4. Nothing is ever lost</p><p className="text-xs text-muted-foreground">Works offline, syncs when back online. Financial records are never edited silently; corrections keep the original.</p></li>
        </ol>
      </Panel>
      <Panel title="Delete account data" className="border-coral/40">
        <p className="text-sm text-muted-foreground">Removes every record{mode === "cloud" ? " from Supabase and this device" : " from this browser"}. Export first if you might want it back.</p>
        <Button variant="destructive" className="mt-3" onClick={() => setDelOpen(true)}><IconTrash size={16} /> Delete all my data</Button>
      </Panel>
      <ConfirmDialog open={delOpen} onOpenChange={setDelOpen} title="Delete all your data?" body="This permanently removes tasks, money records, notes, habits and documents. There is no undo." confirmLabel="Delete everything" destructive requireText="DELETE" onConfirm={deleteEverything} />
    </div>
  );
}
