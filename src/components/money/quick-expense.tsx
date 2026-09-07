"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useUI } from "@/store/ui";
import { useSession } from "@/lib/session/session-provider";
import { useRowsOr, useCurrency } from "@/lib/data/hooks";
import { recordTransaction } from "@/lib/money/ledger";
import { newId } from "@/lib/ids";
import { formatMoney } from "@/lib/format";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { todayKey } from "@/lib/dates";

/** Five-second expense entry: amount → category → save. Extras are optional and collapsed. */
export function QuickExpense() {
  const open = useUI((s) => s.expenseOpen);
  const close = useUI((s) => s.closeExpense);
  const announce = useUI((s) => s.announce);
  const { userId } = useSession();
  const currency = useCurrency();
  const categories = useRowsOr("expense_categories").filter((c) => !c.is_archived).sort((a, b) => a.sort_order - b.sort_order);
  const accounts = useRowsOr("accounts").filter((a) => !a.is_archived).sort((a, b) => a.sort_order - b.sort_order);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [merchant, setMerchant] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayKey());
  const [more, setMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const idRef = useRef(newId());
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    idRef.current = newId();
    setAmount("");
    setCategoryId(null);
    setMerchant("");
    setNote("");
    setDate(todayKey());
    setMore(false);
    setAccountId(accounts[0]?.id ?? null);
    const t = window.setTimeout(() => amountRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on open
  }, [open]);

  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0;

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const cat = categories.find((c) => c.id === categoryId);
      await recordTransaction(userId, {
        id: idRef.current,
        type: "expense",
        amount: value,
        category_id: categoryId,
        account_id: accountId,
        merchant: merchant || null,
        note: note || null,
        occurred_on: date,
        is_discretionary: cat ? !cat.is_essential : true,
      });
      announce(`Expense of ${formatMoney(value, currency)} saved`);
      toast.success(`${formatMoney(value, currency)} saved${cat ? ` · ${cat.name}` : ""}`);
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save expense");
      idRef.current = newId();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : close())}>
      <DialogContent className="max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>Add expense</DialogTitle>
            <DialogDescription>Amount, category, save. Details are optional.</DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="exp-amount" className="sr-only">Amount</Label>
            <div className="flex items-center gap-2 rounded-2xl bg-muted/60 px-4 py-3">
              <span className="text-2xl text-muted-foreground">{currency === "INR" ? "₹" : currency}</span>
              <Input id="exp-amount" ref={amountRef} type="number" inputMode="decimal" min="0" step="0.01" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-14 border-0 bg-transparent text-3xl font-semibold tabular-nums shadow-none focus-visible:ring-0" required aria-required="true" />
            </div>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Category</legend>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button key={c.id} type="button" onClick={() => setCategoryId(c.id)} aria-pressed={categoryId === c.id} className={cn("tap rounded-full border px-3 text-sm transition-colors", categoryId === c.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted")}>
                  {c.name}
                </button>
              ))}
            </div>
          </fieldset>
          <button type="button" className="text-sm text-primary underline-offset-4 hover:underline" onClick={() => setMore((v) => !v)} aria-expanded={more}>
            {more ? "Hide details" : "Add details (merchant, account, date, note)"}
          </button>
          {more ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="exp-merchant">Merchant</Label>
                <Input id="exp-merchant" value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Where" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="exp-account">Account</Label>
                <select id="exp-account" className="tap w-full rounded-lg border border-input bg-background px-3 text-sm" value={accountId ?? ""} onChange={(e) => setAccountId(e.target.value || null)}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="exp-date">Date</Label>
                <Input id="exp-date" type="date" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="exp-note">Note</Label>
                <Input id="exp-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
              </div>
            </div>
          ) : null}
          <Button type="submit" size="lg" className="w-full" disabled={!valid || saving}>
            {saving ? "Saving…" : valid ? `Save ${formatMoney(value, currency)}` : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
