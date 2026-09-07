// Domain record types. Field names mirror the Postgres schema so rows sync 1:1.

export interface BaseRecord {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export type ThemePreference = "system" | "dark" | "light";

export interface Profile extends BaseRecord {
  display_name: string | null;
  timezone: string;
  currency: string;
  monthly_income: number;
  income_day: number;
  opening_balance: number;
  protected_savings_min: number;
  daily_limit: number | null;
  weekly_limit: number | null;
  onboarding_completed: boolean;
  theme: ThemePreference;
}

export type AccountType = "cash" | "bank" | "card" | "upi";
export interface Account extends BaseRecord {
  name: string;
  type: AccountType;
  opening_balance: number;
  currency: string;
  is_archived: boolean;
  sort_order: number;
}

export interface ExpenseCategory extends BaseRecord {
  name: string;
  icon: string;
  color: string;
  is_essential: boolean;
  sort_order: number;
  is_archived: boolean;
}

export interface Budget extends BaseRecord {
  category_id: string;
  month: string; // YYYY-MM-01
  amount: number;
}

export type GoalStatus = "active" | "completed" | "paused";
export interface SavingsGoal extends BaseRecord {
  name: string;
  target_amount: number;
  deadline: string | null;
  is_protected: boolean;
  is_emergency_fund: boolean;
  color: string;
  status: GoalStatus;
  planned_monthly: number;
}

export type TransactionType = "expense" | "income" | "transfer" | "contribution" | "repayment";
export type TransactionStatus = "posted" | "reversed" | "reversal";
export interface Transaction extends BaseRecord {
  type: TransactionType;
  amount: number;
  account_id: string | null;
  to_account_id: string | null;
  category_id: string | null;
  merchant: string | null;
  note: string | null;
  occurred_on: string; // YYYY-MM-DD
  occurred_at: string;
  receipt_attachment_id: string | null;
  status: TransactionStatus;
  reverses_id: string | null;
  reversed_by_id: string | null;
  is_discretionary: boolean;
  source: string;
  linked_type: string | null;
  linked_id: string | null;
}

export interface SavingsContribution extends BaseRecord {
  goal_id: string;
  amount: number;
  contributed_on: string;
  transaction_id: string | null;
  note: string | null;
}

export type BillFrequency = "monthly" | "weekly" | "yearly" | "once";
export interface Bill extends BaseRecord {
  name: string;
  amount: number;
  frequency: BillFrequency;
  next_due_on: string;
  category_id: string | null;
  account_id: string | null;
  is_fixed: boolean;
  last_paid_on: string | null;
  status: "active" | "paused" | "ended";
}

export interface Subscription extends BaseRecord {
  name: string;
  amount: number;
  billing_cycle: "monthly" | "yearly" | "weekly";
  next_billing_on: string;
  category_id: string | null;
  is_essential: boolean;
  status: "active" | "paused" | "cancelled";
  started_on: string | null;
}

export interface Debt extends BaseRecord {
  name: string;
  lender: string | null;
  principal: number;
  remaining: number;
  monthly_payment: number;
  due_day: number | null;
  status: "active" | "closed";
}

export type AttachmentKind = "receipt" | "document" | "photo" | "file";
export interface Attachment extends BaseRecord {
  bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  kind: AttachmentKind;
  title: string | null;
  tags: string[];
  linked_type: string | null;
  linked_id: string | null;
  is_vault: boolean;
}

export type InboxKind = "text" | "voice" | "photo" | "file" | "link";
export type InboxStatus = "unprocessed" | "classified" | "archived" | "deleted";
export type Classification =
  | "task"
  | "reminder"
  | "event"
  | "expense"
  | "note"
  | "idea"
  | "shopping"
  | "contact"
  | "document"
  | "habit";
export interface InboxItem extends BaseRecord {
  client_id: string;
  content: string;
  kind: InboxKind;
  url: string | null;
  attachment_id: string | null;
  captured_at: string;
  scheduled_for: string | null;
  status: InboxStatus;
  classified_as: Classification | null;
  linked_type: string | null;
  linked_id: string | null;
}

export type NoteKind = "note" | "idea" | "contact" | "shopping" | "document";
export interface Note extends BaseRecord {
  title: string;
  body: string;
  kind: NoteKind;
  tags: string[];
  pinned: boolean;
  source_inbox_id: string | null;
  related_ids: string[];
}

export interface RoutineStep {
  id: string;
  title: string;
  minutes: number;
}
export interface Routine extends BaseRecord {
  name: string;
  description: string | null;
  kind: "morning" | "evening" | "custom" | "time_block";
  steps: RoutineStep[];
  days: number[];
  start_time: string | null; // HH:MM
  duration_min: number;
  is_active: boolean;
}

export type RecurrenceFrequency = "daily" | "weekly" | "weekdays" | "custom";
export interface Recurrence {
  frequency: RecurrenceFrequency;
  interval?: number;
  days?: number[]; // 0=Sun..6=Sat, used by weekly/custom
  until?: string | null; // YYYY-MM-DD
}

export type TaskStatus = "todo" | "doing" | "done" | "skipped" | "postponed";
export interface Task extends BaseRecord {
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: 1 | 2 | 3 | 4;
  category: string | null;
  due_on: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  completed_at: string | null;
  recurrence: Recurrence | null;
  reminder_offsets: number[];
  routine_id: string | null;
  is_top_priority: boolean;
  sort_order: number;
  source_inbox_id: string | null;
}

export type EventStatus = "scheduled" | "done" | "skipped" | "postponed" | "cancelled";
export interface CalendarEvent extends BaseRecord {
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  location: string | null;
  category: string | null;
  recurrence: Recurrence | null;
  reminder_offsets: number[];
  status: EventStatus;
  source_inbox_id: string | null;
}

export type NotificationLevel = "gentle" | "important" | "persistent";
export type ReminderStatus = "pending" | "sent" | "acknowledged" | "snoozed" | "dismissed";
export interface Reminder extends BaseRecord {
  title: string;
  body: string | null;
  remind_at: string;
  level: NotificationLevel;
  status: ReminderStatus;
  snoozed_until: string | null;
  linked_type: string | null;
  linked_id: string | null;
}

export type HabitKind = "habit" | "medicine" | "exercise" | "water" | "sleep" | "rehab";
export interface Habit extends BaseRecord {
  name: string;
  kind: HabitKind;
  schedule_days: number[];
  times: string[];
  target_per_day: number;
  unit: string | null;
  is_essential: boolean;
  color: string;
  notes: string | null;
  is_active: boolean;
  reminder_level: NotificationLevel;
}

export type HabitLogStatus = "done" | "skipped" | "missed";
export interface HabitLog extends BaseRecord {
  habit_id: string;
  log_date: string;
  status: HabitLogStatus;
  value: number | null;
  note: string | null;
  logged_at: string;
}

export interface DailySummary {
  tasksDone: number;
  tasksOpen: number;
  eventsCount: number;
  spent: number;
  captures: number;
  habitsDone: number;
  habitsPlanned: number;
  highlights: string[];
}
export interface DailyReview extends BaseRecord {
  review_date: string;
  kind: "morning" | "evening";
  top_priorities: string[];
  intention: string | null;
  went_well: string | null;
  to_improve: string | null;
  mood: number | null;
  energy: number | null;
  summary: DailySummary | null;
  completed_at: string | null;
}

export interface NotificationPreferences extends BaseRecord {
  browser_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  gentle_enabled: boolean;
  important_enabled: boolean;
  persistent_enabled: boolean;
  default_offsets: number[];
}

export type NotificationStatus = "unread" | "read" | "acknowledged";
export interface AppNotification extends BaseRecord {
  title: string;
  body: string | null;
  level: NotificationLevel;
  status: NotificationStatus;
  fire_at: string;
  linked_type: string | null;
  linked_id: string | null;
}

export type AuditAction = "create" | "update" | "delete" | "reverse";
export interface AuditEvent extends BaseRecord {
  entity_type: string;
  entity_id: string;
  action: AuditAction;
  before: unknown;
  after: unknown;
  occurred_at: string;
}

export interface TableMap {
  profiles: Profile;
  accounts: Account;
  expense_categories: ExpenseCategory;
  budgets: Budget;
  savings_goals: SavingsGoal;
  savings_contributions: SavingsContribution;
  transactions: Transaction;
  bills: Bill;
  subscriptions: Subscription;
  debts: Debt;
  attachments: Attachment;
  inbox_items: InboxItem;
  notes: Note;
  routines: Routine;
  tasks: Task;
  events: CalendarEvent;
  reminders: Reminder;
  habits: Habit;
  habit_logs: HabitLog;
  daily_reviews: DailyReview;
  notification_preferences: NotificationPreferences;
  notifications: AppNotification;
  audit_events: AuditEvent;
}
export type TableName = keyof TableMap;
export const TABLE_NAMES: TableName[] = [
  "profiles",
  "accounts",
  "expense_categories",
  "budgets",
  "savings_goals",
  "savings_contributions",
  "transactions",
  "bills",
  "subscriptions",
  "debts",
  "attachments",
  "inbox_items",
  "notes",
  "routines",
  "tasks",
  "events",
  "reminders",
  "habits",
  "habit_logs",
  "daily_reviews",
  "notification_preferences",
  "notifications",
  "audit_events",
];

export type NewRecord<T extends BaseRecord> = Omit<T, keyof BaseRecord> & Partial<Pick<T, "id">>;
