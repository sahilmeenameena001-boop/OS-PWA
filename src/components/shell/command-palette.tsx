"use client";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useUI } from "@/store/ui";
import { useRowsOr, useCategoryMap } from "@/lib/data/hooks";
import { buildMemoryItems, matchesQuery } from "@/lib/memory/summary";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { formatDateHuman } from "@/lib/dates";

const PAGES = [
  { label: "Today", href: "/" },
  { label: "Calendar", href: "/calendar" },
  { label: "Inbox", href: "/inbox" },
  { label: "Money", href: "/money" },
  { label: "Savings", href: "/savings" },
  { label: "Habits", href: "/habits" },
  { label: "Memory", href: "/memory" },
  { label: "Vault", href: "/vault" },
  { label: "Insights", href: "/insights" },
  { label: "Settings", href: "/settings" },
  { label: "Morning plan", href: "/review?kind=morning" },
  { label: "Evening review", href: "/review?kind=evening" },
];

export function CommandPalette() {
  const open = useUI((s) => s.paletteOpen);
  const setOpen = useUI((s) => s.setPaletteOpen);
  const openCapture = useUI((s) => s.openCapture);
  const openExpense = useUI((s) => s.openExpense);
  const router = useRouter();
  const notes = useRowsOr("notes");
  const inbox = useRowsOr("inbox_items");
  const tasks = useRowsOr("tasks");
  const events = useRowsOr("events");
  const transactions = useRowsOr("transactions");
  const attachments = useRowsOr("attachments");
  const catMap = useCategoryMap();
  const items = useMemo(
    () => buildMemoryItems({ notes, inbox, tasks, events, transactions, attachments, categoryNames: new Map([...catMap].map(([k, v]) => [k, v.name])) }),
    [notes, inbox, tasks, events, transactions, attachments, catMap],
  );
  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  const hrefFor = (linkedType: string, id: string) => {
    if (linkedType === "tasks" || linkedType === "events") return "/calendar";
    if (linkedType === "transactions") return "/money?tab=transactions";
    if (linkedType === "inbox_items") return "/inbox";
    if (linkedType === "attachments") return "/vault";
    return `/memory?focus=${id}`;
  };
  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Search and commands" description="Jump anywhere or find any memory">
      <CommandInput placeholder="Search notes, tasks, expenses, or type a page…" />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>Nothing found. Try fewer words.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => { setOpen(false); openCapture(); }}>Quick capture</CommandItem>
          <CommandItem onSelect={() => { setOpen(false); openExpense(); }}>Add expense</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Go to">
          {PAGES.map((p) => (
            <CommandItem key={p.href} value={`page ${p.label}`} onSelect={() => go(p.href)}>{p.label}</CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Memory">
          {items.slice(0, 400).map((m) => (
            <CommandItem key={m.id} value={`${m.type} ${m.title} ${m.body ?? ""} ${m.category ?? ""}`} onSelect={() => go(hrefFor(m.linkedType, m.linkedId))} keywords={[m.type]}>
              <span className="w-16 shrink-0 text-xs text-muted-foreground capitalize">{m.type}</span>
              <span className="flex-1 truncate">{m.title}</span>
              <span className="text-xs text-muted-foreground">{formatDateHuman(m.dateKey)}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export { matchesQuery };
