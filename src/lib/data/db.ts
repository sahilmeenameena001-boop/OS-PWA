import Dexie, { type Table } from "dexie";
import type { TableMap, TableName } from "@/lib/types";

export type OutboxOp = "upsert" | "delete";
export type OutboxStatus = "pending" | "synced" | "failed";
export interface OutboxEntry {
  id: string; // idempotency key: `${table}:${recordId}:${op}:${updated_at}`
  table: TableName;
  op: OutboxOp;
  record_id: string;
  user_id: string;
  payload: unknown;
  created_at: string;
  attempts: number;
  status: OutboxStatus;
  error: string | null;
}

export interface KV {
  key: string;
  value: unknown;
}

type Tables = {
  [K in TableName]: Table<TableMap[K], string, TableMap[K]>;
};

export class LifeDB extends Dexie {
  outbox!: Table<OutboxEntry, string, OutboxEntry>;
  kv!: Table<KV, string, KV>;
  declare profiles: Tables["profiles"];
  declare accounts: Tables["accounts"];
  declare expense_categories: Tables["expense_categories"];
  declare budgets: Tables["budgets"];
  declare savings_goals: Tables["savings_goals"];
  declare savings_contributions: Tables["savings_contributions"];
  declare transactions: Tables["transactions"];
  declare bills: Tables["bills"];
  declare subscriptions: Tables["subscriptions"];
  declare debts: Tables["debts"];
  declare attachments: Tables["attachments"];
  declare inbox_items: Tables["inbox_items"];
  declare notes: Tables["notes"];
  declare routines: Tables["routines"];
  declare tasks: Tables["tasks"];
  declare events: Tables["events"];
  declare reminders: Tables["reminders"];
  declare habits: Tables["habits"];
  declare habit_logs: Tables["habit_logs"];
  declare daily_reviews: Tables["daily_reviews"];
  declare notification_preferences: Tables["notification_preferences"];
  declare notifications: Tables["notifications"];
  declare audit_events: Tables["audit_events"];

  constructor(name = "my-life-os") {
    super(name);
    this.version(1).stores({
      profiles: "id, user_id",
      accounts: "id, user_id",
      expense_categories: "id, user_id",
      budgets: "id, user_id, [user_id+month], category_id",
      savings_goals: "id, user_id, status",
      savings_contributions: "id, user_id, goal_id, contributed_on",
      transactions: "id, user_id, occurred_on, category_id, status, type, linked_id",
      bills: "id, user_id, next_due_on, status",
      subscriptions: "id, user_id, next_billing_on, status",
      debts: "id, user_id, status",
      attachments: "id, user_id, created_at, linked_id",
      inbox_items: "id, user_id, client_id, status, captured_at",
      notes: "id, user_id, created_at, pinned",
      routines: "id, user_id",
      tasks: "id, user_id, status, due_on, scheduled_start",
      events: "id, user_id, start_at, status",
      reminders: "id, user_id, status, remind_at",
      habits: "id, user_id, is_active",
      habit_logs: "id, user_id, habit_id, log_date, [habit_id+log_date]",
      daily_reviews: "id, user_id, review_date, [review_date+kind]",
      notification_preferences: "id, user_id",
      notifications: "id, user_id, status, fire_at",
      audit_events: "id, user_id, entity_id, occurred_at",
      outbox: "id, status, created_at, record_id",
      kv: "key",
    });
  }

  tbl<K extends TableName>(name: K): Tables[K] {
    return this.table(name) as unknown as Tables[K];
  }
}

let instance: LifeDB | null = null;
export function getDB(): LifeDB {
  if (!instance) instance = new LifeDB();
  return instance;
}

/** Test helper: swap the singleton for an isolated database. */
export function setDB(db: LifeDB | null): void {
  instance = db;
}
