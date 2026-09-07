import { addDays, subDays, setHours, setMinutes } from "date-fns";
import { getDB } from "@/lib/data/db";
import { newId } from "@/lib/ids";
import { toDateKey, monthKey } from "@/lib/dates";
import type { BaseRecord, TableMap, TableName } from "@/lib/types";

type Seedable<T extends BaseRecord> = Omit<T, keyof BaseRecord> & Partial<BaseRecord>;

function stamp<T extends BaseRecord>(userId: string, rows: Seedable<T>[], at: string): T[] {
  return rows.map((r) => ({ id: newId(), user_id: userId, created_at: at, updated_at: at, ...r }) as T);
}

async function put<K extends TableName>(table: K, rows: TableMap[K][]): Promise<void> {
  if (rows.length) await getDB().tbl(table).bulkPut(rows);
}

export const DEFAULT_CATEGORIES: { name: string; icon: string; color: string; is_essential: boolean }[] = [
  { name: "Groceries", icon: "basket", color: "mint", is_essential: true },
  { name: "Food & Dining", icon: "bowl", color: "amber", is_essential: false },
  { name: "Transport", icon: "car", color: "blue", is_essential: true },
  { name: "Rent & Home", icon: "home", color: "violet", is_essential: true },
  { name: "Utilities", icon: "bolt", color: "amber", is_essential: true },
  { name: "Health", icon: "heart", color: "coral", is_essential: true },
  { name: "Shopping", icon: "bag", color: "pink", is_essential: false },
  { name: "Entertainment", icon: "film", color: "violet", is_essential: false },
  { name: "Subscriptions", icon: "repeat", color: "blue", is_essential: false },
  { name: "Personal", icon: "sparkle", color: "mint", is_essential: false },
];

/** Seeds the demo user with realistic data, or just a profile for real users. Idempotent. */
export async function ensureSeeded(userId: string, opts: { onlyProfile?: boolean } = {}): Promise<void> {
  const db = getDB();
  const existing = await db.profiles.where("user_id").equals(userId).first();
  if (existing) return;
  const now = new Date();
  const at = now.toISOString();
  const demo = !opts.onlyProfile;

  await db.profiles.put({
    id: userId,
    user_id: userId,
    display_name: demo ? "Aarav" : null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
    currency: "INR",
    monthly_income: demo ? 85000 : 0,
    income_day: 1,
    opening_balance: demo ? 12000 : 0,
    protected_savings_min: demo ? 15000 : 0,
    daily_limit: null,
    weekly_limit: null,
    onboarding_completed: demo,
    theme: "system",
    created_at: at,
    updated_at: at,
  });
  await db.notification_preferences.put({ id: newId(), user_id: userId, browser_enabled: false, quiet_hours_start: "22:30", quiet_hours_end: "07:00", gentle_enabled: true, important_enabled: true, persistent_enabled: true, default_offsets: [10], created_at: at, updated_at: at });
  if (!demo) return;

  const categories = stamp<TableMap["expense_categories"]>(userId, DEFAULT_CATEGORIES.map((c, i) => ({ ...c, sort_order: i, is_archived: false })), at);
  await put("expense_categories", categories);
  const cat = (name: string) => categories.find((c) => c.name === name)?.id ?? null;

  const accounts = stamp<TableMap["accounts"]>(userId, [
    { name: "HDFC Savings", type: "bank", opening_balance: 42000, currency: "INR", is_archived: false, sort_order: 0 },
    { name: "UPI (GPay)", type: "upi", opening_balance: 3500, currency: "INR", is_archived: false, sort_order: 1 },
    { name: "Cash", type: "cash", opening_balance: 2200, currency: "INR", is_archived: false, sort_order: 2 },
    { name: "Credit Card", type: "card", opening_balance: 0, currency: "INR", is_archived: false, sort_order: 3 },
  ], at);
  await put("accounts", accounts);
  const acc = (name: string) => accounts.find((a) => a.name.startsWith(name))?.id ?? null;

  const month = monthKey(now);
  await put("budgets", stamp<TableMap["budgets"]>(userId, [
    { category_id: cat("Groceries")!, month, amount: 8000 },
    { category_id: cat("Food & Dining")!, month, amount: 6000 },
    { category_id: cat("Transport")!, month, amount: 4000 },
    { category_id: cat("Shopping")!, month, amount: 5000 },
    { category_id: cat("Entertainment")!, month, amount: 2500 },
  ], at));

  const goals = stamp<TableMap["savings_goals"]>(userId, [
    { name: "Emergency fund", target_amount: 150000, deadline: toDateKey(addDays(now, 365)), is_protected: true, is_emergency_fund: true, color: "mint", status: "active", planned_monthly: 8000 },
    { name: "Protected savings", target_amount: 60000, deadline: null, is_protected: true, is_emergency_fund: false, color: "blue", status: "active", planned_monthly: 5000 },
    { name: "Goa trip", target_amount: 25000, deadline: toDateKey(addDays(now, 120)), is_protected: false, is_emergency_fund: false, color: "amber", status: "active", planned_monthly: 3000 },
  ], at);
  await put("savings_goals", goals);

  const day = (n: number) => toDateKey(subDays(now, n));
  const ts = (n: number, h: number, m = 0) => setMinutes(setHours(subDays(now, n), h), m).toISOString();

  const txRows: Seedable<TableMap["transactions"]>[] = [
    { type: "income", amount: 85000, account_id: acc("HDFC"), to_account_id: null, category_id: null, merchant: "Salary", note: "Monthly salary", occurred_on: toDateKey(new Date(now.getFullYear(), now.getMonth(), 1)), occurred_at: new Date(now.getFullYear(), now.getMonth(), 1, 9).toISOString(), receipt_attachment_id: null, status: "posted", reverses_id: null, reversed_by_id: null, is_discretionary: false, source: "manual", linked_type: null, linked_id: null },
    { type: "expense", amount: 1240, account_id: acc("UPI"), to_account_id: null, category_id: cat("Groceries"), merchant: "BigBasket", note: null, occurred_on: day(0), occurred_at: ts(0, 9, 10), receipt_attachment_id: null, status: "posted", reverses_id: null, reversed_by_id: null, is_discretionary: false, source: "manual", linked_type: null, linked_id: null },
    { type: "expense", amount: 180, account_id: acc("UPI"), to_account_id: null, category_id: cat("Food & Dining"), merchant: "Chai Point", note: null, occurred_on: day(0), occurred_at: ts(0, 11, 30), receipt_attachment_id: null, status: "posted", reverses_id: null, reversed_by_id: null, is_discretionary: true, source: "manual", linked_type: null, linked_id: null },
    { type: "expense", amount: 320, account_id: acc("Cash"), to_account_id: null, category_id: cat("Transport"), merchant: "Auto", note: "Office", occurred_on: day(1), occurred_at: ts(1, 9), receipt_attachment_id: null, status: "posted", reverses_id: null, reversed_by_id: null, is_discretionary: false, source: "manual", linked_type: null, linked_id: null },
    { type: "expense", amount: 650, account_id: acc("Credit"), to_account_id: null, category_id: cat("Food & Dining"), merchant: "Swiggy", note: null, occurred_on: day(1), occurred_at: ts(1, 20, 15), receipt_attachment_id: null, status: "posted", reverses_id: null, reversed_by_id: null, is_discretionary: true, source: "manual", linked_type: null, linked_id: null },
    { type: "expense", amount: 2199, account_id: acc("Credit"), to_account_id: null, category_id: cat("Shopping"), merchant: "Amazon", note: "Running shoes", occurred_on: day(3), occurred_at: ts(3, 14), receipt_attachment_id: null, status: "posted", reverses_id: null, reversed_by_id: null, is_discretionary: true, source: "manual", linked_type: null, linked_id: null },
    { type: "expense", amount: 180, account_id: acc("UPI"), to_account_id: null, category_id: cat("Food & Dining"), merchant: "Chai Point", note: null, occurred_on: day(3), occurred_at: ts(3, 11), receipt_attachment_id: null, status: "posted", reverses_id: null, reversed_by_id: null, is_discretionary: true, source: "manual", linked_type: null, linked_id: null },
    { type: "expense", amount: 499, account_id: acc("Credit"), to_account_id: null, category_id: cat("Subscriptions"), merchant: "Netflix", note: null, occurred_on: day(5), occurred_at: ts(5, 8), receipt_attachment_id: null, status: "posted", reverses_id: null, reversed_by_id: null, is_discretionary: true, source: "subscription", linked_type: null, linked_id: null },
    { type: "expense", amount: 180, account_id: acc("UPI"), to_account_id: null, category_id: cat("Food & Dining"), merchant: "Chai Point", note: null, occurred_on: day(5), occurred_at: ts(5, 16), receipt_attachment_id: null, status: "posted", reverses_id: null, reversed_by_id: null, is_discretionary: true, source: "manual", linked_type: null, linked_id: null },
    { type: "expense", amount: 860, account_id: acc("UPI"), to_account_id: null, category_id: cat("Health"), merchant: "Apollo Pharmacy", note: "Monthly medicines", occurred_on: day(6), occurred_at: ts(6, 18), receipt_attachment_id: null, status: "posted", reverses_id: null, reversed_by_id: null, is_discretionary: false, source: "manual", linked_type: null, linked_id: null },
    { type: "expense", amount: 1500, account_id: acc("HDFC"), to_account_id: null, category_id: cat("Utilities"), merchant: "BESCOM", note: "Electricity", occurred_on: day(8), occurred_at: ts(8, 10), receipt_attachment_id: null, status: "posted", reverses_id: null, reversed_by_id: null, is_discretionary: false, source: "bill", linked_type: null, linked_id: null },
    { type: "contribution", amount: 8000, account_id: acc("HDFC"), to_account_id: null, category_id: null, merchant: "Savings", note: "Emergency fund", occurred_on: day(9), occurred_at: ts(9, 9), receipt_attachment_id: null, status: "posted", reverses_id: null, reversed_by_id: null, is_discretionary: false, source: "savings", linked_type: "savings_goals", linked_id: goals[0].id },
  ];
  const txs = stamp<TableMap["transactions"]>(userId, txRows, at);
  await put("transactions", txs);

  await put("savings_contributions", stamp<TableMap["savings_contributions"]>(userId, [
    { goal_id: goals[0].id, amount: 8000, contributed_on: day(9), transaction_id: txs[txs.length - 1].id, note: null },
    { goal_id: goals[0].id, amount: 8000, contributed_on: day(39), transaction_id: null, note: null },
    { goal_id: goals[0].id, amount: 8000, contributed_on: day(69), transaction_id: null, note: null },
    { goal_id: goals[1].id, amount: 5000, contributed_on: day(9), transaction_id: null, note: null },
    { goal_id: goals[1].id, amount: 5000, contributed_on: day(39), transaction_id: null, note: null },
    { goal_id: goals[2].id, amount: 3000, contributed_on: day(9), transaction_id: null, note: null },
  ], at));

  await put("bills", stamp<TableMap["bills"]>(userId, [
    { name: "Rent", amount: 18000, frequency: "monthly", next_due_on: toDateKey(addDays(now, 3)), category_id: cat("Rent & Home"), account_id: acc("HDFC"), is_fixed: true, last_paid_on: null, status: "active" },
    { name: "Internet", amount: 999, frequency: "monthly", next_due_on: toDateKey(addDays(now, 1)), category_id: cat("Utilities"), account_id: acc("HDFC"), is_fixed: true, last_paid_on: null, status: "active" },
    { name: "Mobile", amount: 449, frequency: "monthly", next_due_on: toDateKey(addDays(now, 12)), category_id: cat("Utilities"), account_id: acc("UPI"), is_fixed: true, last_paid_on: null, status: "active" },
    { name: "Gym", amount: 1500, frequency: "monthly", next_due_on: toDateKey(subDays(now, 1)), category_id: cat("Health"), account_id: acc("UPI"), is_fixed: false, last_paid_on: null, status: "active" },
  ], at));

  await put("subscriptions", stamp<TableMap["subscriptions"]>(userId, [
    { name: "Netflix", amount: 499, billing_cycle: "monthly", next_billing_on: toDateKey(addDays(now, 25)), category_id: cat("Subscriptions"), is_essential: false, status: "active", started_on: day(400) },
    { name: "Spotify", amount: 119, billing_cycle: "monthly", next_billing_on: toDateKey(addDays(now, 9)), category_id: cat("Subscriptions"), is_essential: false, status: "active", started_on: day(200) },
    { name: "iCloud 200GB", amount: 219, billing_cycle: "monthly", next_billing_on: toDateKey(addDays(now, 15)), category_id: cat("Subscriptions"), is_essential: true, status: "active", started_on: day(600) },
  ], at));

  await put("debts", stamp<TableMap["debts"]>(userId, [
    { name: "Laptop EMI", lender: "HDFC", principal: 72000, remaining: 36000, monthly_payment: 6000, due_day: 7, status: "active" },
  ], at));

  const habits = stamp<TableMap["habits"]>(userId, [
    { name: "Morning medicine", kind: "medicine", schedule_days: [0, 1, 2, 3, 4, 5, 6], times: ["08:00"], target_per_day: 1, unit: null, is_essential: true, color: "coral", notes: "With breakfast", is_active: true, reminder_level: "persistent" },
    { name: "Drink water", kind: "water", schedule_days: [0, 1, 2, 3, 4, 5, 6], times: [], target_per_day: 8, unit: "glasses", is_essential: true, color: "blue", notes: null, is_active: true, reminder_level: "gentle" },
    { name: "Walk 20 min", kind: "exercise", schedule_days: [1, 2, 3, 4, 5], times: ["18:30"], target_per_day: 1, unit: null, is_essential: false, color: "mint", notes: null, is_active: true, reminder_level: "gentle" },
    { name: "Knee rehab stretches", kind: "rehab", schedule_days: [1, 3, 5], times: ["07:30"], target_per_day: 1, unit: null, is_essential: true, color: "amber", notes: "5 reps each side", is_active: true, reminder_level: "important" },
    { name: "In bed by 23:00", kind: "sleep", schedule_days: [0, 1, 2, 3, 4, 5, 6], times: ["23:00"], target_per_day: 1, unit: null, is_essential: false, color: "violet", notes: null, is_active: true, reminder_level: "gentle" },
  ], at);
  await put("habits", habits);
  const logs: Seedable<TableMap["habit_logs"]>[] = [];
  for (let d = 1; d <= 14; d++) {
    const date = subDays(now, d);
    const key = toDateKey(date);
    for (const h of habits) {
      if (!h.schedule_days.includes(date.getDay())) continue;
      const roll = (d * 7 + h.name.length) % 10;
      const status = roll < 8 ? "done" : roll === 8 ? "skipped" : "missed";
      logs.push({ habit_id: h.id, log_date: key, status, value: h.kind === "water" ? (status === "done" ? 8 : 4) : null, note: null, logged_at: setHours(date, 21).toISOString() });
    }
  }
  logs.push({ habit_id: habits[0].id, log_date: day(0), status: "done", value: null, note: null, logged_at: ts(0, 8, 5) });
  await put("habit_logs", stamp<TableMap["habit_logs"]>(userId, logs, at));

  const routines = stamp<TableMap["routines"]>(userId, [
    { name: "Morning start", description: "Ease into the day", kind: "morning", steps: [{ id: newId(), title: "Medicine + water", minutes: 5 }, { id: newId(), title: "Stretch", minutes: 10 }, { id: newId(), title: "Plan top 3", minutes: 5 }], days: [0, 1, 2, 3, 4, 5, 6], start_time: "07:30", duration_min: 20, is_active: true },
    { name: "Evening wind-down", description: null, kind: "evening", steps: [{ id: newId(), title: "Review today", minutes: 5 }, { id: newId(), title: "Log expenses", minutes: 3 }, { id: newId(), title: "Tomorrow's first task", minutes: 2 }], days: [0, 1, 2, 3, 4, 5, 6], start_time: "21:30", duration_min: 10, is_active: true },
    { name: "Deep work block", description: "No notifications", kind: "time_block", steps: [], days: [1, 2, 3, 4, 5], start_time: "10:00", duration_min: 90, is_active: true },
  ], at);
  await put("routines", routines);

  const t = (h: number, m = 0, offset = 0) => setMinutes(setHours(addDays(now, offset), h), m).toISOString();
  await put("tasks", stamp<TableMap["tasks"]>(userId, [
    { title: "Pay internet bill", description: null, status: "todo", priority: 1, category: "Money", due_on: day(0), scheduled_start: t(10), scheduled_end: t(10, 15), completed_at: null, recurrence: null, reminder_offsets: [10], routine_id: null, is_top_priority: true, sort_order: 0, source_inbox_id: null },
    { title: "Call physiotherapist to reschedule", description: "Ask about Thursday slot", status: "todo", priority: 1, category: "Health", due_on: day(0), scheduled_start: t(11, 30), scheduled_end: t(11, 45), completed_at: null, recurrence: null, reminder_offsets: [5], routine_id: null, is_top_priority: true, sort_order: 1, source_inbox_id: null },
    { title: "Draft project proposal", description: "Outline sections and send to Priya", status: "todo", priority: 2, category: "Work", due_on: day(0), scheduled_start: t(14), scheduled_end: t(16), completed_at: null, recurrence: null, reminder_offsets: [10], routine_id: null, is_top_priority: true, sort_order: 2, source_inbox_id: null },
    { title: "Buy vegetables", description: null, status: "todo", priority: 3, category: "Home", due_on: day(0), scheduled_start: null, scheduled_end: null, completed_at: null, recurrence: null, reminder_offsets: [], routine_id: null, is_top_priority: false, sort_order: 3, source_inbox_id: null },
    { title: "Submit expense report", description: null, status: "todo", priority: 2, category: "Work", due_on: day(2), scheduled_start: null, scheduled_end: null, completed_at: null, recurrence: null, reminder_offsets: [], routine_id: null, is_top_priority: false, sort_order: 4, source_inbox_id: null },
    { title: "Renew car insurance", description: null, status: "todo", priority: 2, category: "Money", due_on: day(1), scheduled_start: null, scheduled_end: null, completed_at: null, recurrence: null, reminder_offsets: [], routine_id: null, is_top_priority: false, sort_order: 5, source_inbox_id: null },
    { title: "Weekly review", description: null, status: "todo", priority: 3, category: "Personal", due_on: toDateKey(addDays(now, 1)), scheduled_start: t(18, 0, 1), scheduled_end: t(18, 30, 1), completed_at: null, recurrence: { frequency: "weekly", days: [addDays(now, 1).getDay()] }, reminder_offsets: [15], routine_id: null, is_top_priority: false, sort_order: 6, source_inbox_id: null },
    { title: "Reply to landlord", description: null, status: "done", priority: 2, category: "Home", due_on: day(1), scheduled_start: null, scheduled_end: null, completed_at: ts(1, 12), recurrence: null, reminder_offsets: [], routine_id: null, is_top_priority: false, sort_order: 7, source_inbox_id: null },
    { title: "Book dentist appointment", description: null, status: "done", priority: 3, category: "Health", due_on: day(2), scheduled_start: null, scheduled_end: null, completed_at: ts(2, 15), recurrence: null, reminder_offsets: [], routine_id: null, is_top_priority: false, sort_order: 8, source_inbox_id: null },
  ], at));

  await put("events", stamp<TableMap["events"]>(userId, [
    { title: "Team standup", description: null, start_at: t(9, 30), end_at: t(9, 45), all_day: false, location: "Meet", category: "Work", recurrence: { frequency: "weekdays" }, reminder_offsets: [5], status: "scheduled", source_inbox_id: null },
    { title: "Physio session", description: "Bring knee brace", start_at: t(17, 0), end_at: t(17, 45), all_day: false, location: "Rehab clinic, Indiranagar", category: "Health", recurrence: null, reminder_offsets: [30, 10], status: "scheduled", source_inbox_id: null },
    { title: "Dinner with Neha", description: null, start_at: t(20, 0, 1), end_at: t(22, 0, 1), all_day: false, location: "Toit, Indiranagar", category: "Personal", recurrence: null, reminder_offsets: [60], status: "scheduled", source_inbox_id: null },
    { title: "Client review", description: null, start_at: t(15, 0, 3), end_at: t(16, 0, 3), all_day: false, location: null, category: "Work", recurrence: null, reminder_offsets: [15], status: "scheduled", source_inbox_id: null },
    { title: "Amma's birthday", description: null, start_at: t(0, 0, 6), end_at: t(23, 59, 6), all_day: true, location: null, category: "Personal", recurrence: null, reminder_offsets: [1440], status: "scheduled", source_inbox_id: null },
  ], at));

  await put("reminders", stamp<TableMap["reminders"]>(userId, [
    { title: "Take evening medicine", body: null, remind_at: t(21, 0), level: "persistent", status: "pending", snoozed_until: null, linked_type: null, linked_id: null },
    { title: "Water the plants", body: null, remind_at: t(8, 0, 1), level: "gentle", status: "pending", snoozed_until: null, linked_type: null, linked_id: null },
  ], at));

  await put("inbox_items", stamp<TableMap["inbox_items"]>(userId, [
    { client_id: newId(), content: "Ask Ravi about the Diwali trip dates", kind: "text", url: null, attachment_id: null, captured_at: ts(0, 8, 40), scheduled_for: null, status: "unprocessed", classified_as: null, linked_type: null, linked_id: null },
    { client_id: newId(), content: "Idea: weekly meal prep on Sundays to cut Swiggy spend", kind: "text", url: null, attachment_id: null, captured_at: ts(1, 22, 10), scheduled_for: null, status: "unprocessed", classified_as: null, linked_type: null, linked_id: null },
    { client_id: newId(), content: "Article on sleep and memory", kind: "link", url: "https://www.sleepfoundation.org/how-sleep-works/memory-and-sleep", attachment_id: null, captured_at: ts(2, 13), scheduled_for: null, status: "unprocessed", classified_as: null, linked_type: null, linked_id: null },
    { client_id: newId(), content: "Buy milk, eggs, bananas", kind: "text", url: null, attachment_id: null, captured_at: ts(2, 19), scheduled_for: null, status: "classified", classified_as: "shopping", linked_type: "notes", linked_id: null },
  ], at));

  await put("notes", stamp<TableMap["notes"]>(userId, [
    { title: "Physio exercises", body: "Wall sits 3x30s, straight-leg raise 3x10, calf stretch 2x20s. Ice after if sore.", kind: "note", tags: ["health", "rehab"], pinned: true, source_inbox_id: null, related_ids: [] },
    { title: "Landlord", body: "Mr. Sharma — 98450 12345 — prefers WhatsApp after 6pm.", kind: "contact", tags: ["home"], pinned: true, source_inbox_id: null, related_ids: [] },
    { title: "Meal prep idea", body: "Sunday: dal, rajma, roasted veg. Freeze in 4 boxes.", kind: "idea", tags: ["food", "money"], pinned: false, source_inbox_id: null, related_ids: [] },
    { title: "Groceries", body: "Milk, eggs, bananas, oats, curd", kind: "shopping", tags: [], pinned: false, source_inbox_id: null, related_ids: [] },
    { title: "Wifi password", body: "Router login is on the sticker under the router. Network: HomeNet_5G", kind: "note", tags: ["home"], pinned: false, source_inbox_id: null, related_ids: [] },
  ], at));

  await put("daily_reviews", stamp<TableMap["daily_reviews"]>(userId, [
    { review_date: day(1), kind: "evening", top_priorities: [], intention: null, went_well: "Finished the landlord thread and kept walk streak.", to_improve: "Log expenses as they happen.", mood: 4, energy: 3, summary: null, completed_at: ts(1, 21, 40) },
    { review_date: day(1), kind: "morning", top_priorities: ["Reply to landlord", "Book dentist", "Walk"], intention: "Calm and steady.", went_well: null, to_improve: null, mood: null, energy: 3, summary: null, completed_at: ts(1, 7, 50) },
  ], at));

  await put("notifications", stamp<TableMap["notifications"]>(userId, [
    { title: "Gym membership was due yesterday", body: "₹1,500 · mark paid or reschedule", level: "important", status: "unread", fire_at: ts(0, 7), linked_type: "bills", linked_id: null },
    { title: "Internet bill due tomorrow", body: "₹999 from HDFC Savings", level: "gentle", status: "unread", fire_at: ts(0, 7, 1), linked_type: "bills", linked_id: null },
  ], at));
}
