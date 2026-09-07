import { getDB } from "@/lib/data/db";
import { DEMO_USER_ID, newId } from "@/lib/ids";

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

/** Bumped when the local bootstrap changes. Version 1 shipped a demo dataset; version 2 starts empty. */
const SEED_VERSION = 2;
const SEED_KEY = "seed:version";

/**
 * Creates an empty profile and default notification preferences for a user who has none.
 * No sample data: the app starts blank and onboarding collects the real numbers.
 */
export async function ensureSeeded(userId: string): Promise<void> {
  const db = getDB();
  await purgeLegacyDemoData(userId);
  const existing = await db.profiles.where("user_id").equals(userId).first();
  if (existing) return;
  const at = new Date().toISOString();
  await db.profiles.put({
    id: userId,
    user_id: userId,
    display_name: null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
    currency: "INR",
    monthly_income: 0,
    income_day: 1,
    opening_balance: 0,
    protected_savings_min: 0,
    daily_limit: null,
    weekly_limit: null,
    onboarding_completed: false,
    theme: "system",
    created_at: at,
    updated_at: at,
  });
  await db.notification_preferences.put({ id: newId(), user_id: userId, browser_enabled: false, quiet_hours_start: "22:30", quiet_hours_end: "07:00", gentle_enabled: true, important_enabled: true, persistent_enabled: true, default_offsets: [10], created_at: at, updated_at: at });
}

/** One-time cleanup: browsers that ran the earlier build hold sample data under the local user id. */
async function purgeLegacyDemoData(userId: string): Promise<void> {
  const db = getDB();
  const mark = await db.kv.get(SEED_KEY);
  if (typeof mark?.value === "number" && mark.value >= SEED_VERSION) return;
  if (userId !== DEMO_USER_ID) {
    await db.kv.put({ key: SEED_KEY, value: SEED_VERSION });
    return; // cloud accounts never had sample data; leave their synced copy alone
  }
  const hadProfile = await db.profiles.where("user_id").equals(userId).first();
  if (hadProfile) {
    await db.transaction("rw", db.tables, async () => {
      for (const t of db.tables) {
        if (t.name === "kv") continue;
        if (t.name === "outbox") {
          await db.outbox.clear();
          continue;
        }
        await t.where("user_id").equals(userId).delete();
      }
    });
  }
  await db.kv.put({ key: SEED_KEY, value: SEED_VERSION });
}
