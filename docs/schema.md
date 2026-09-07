# Schema notes

All private tables carry `id uuid`, `user_id uuid`, `created_at`, `updated_at` (trigger-maintained) and are protected by RLS policies of the form `(select auth.uid()) = user_id` for select/insert/update/delete. `audit_events` is append-only (no update/delete policy).

| Table | Purpose | Notes |
| --- | --- | --- |
| profiles | Per-user settings and money setup | `id = auth.users.id`; created by trigger on signup |
| accounts | cash / bank / card / upi | `opening_balance` is the starting point; balances are derived |
| expense_categories | Spending categories | `is_essential` excludes from cooling-off logic |
| budgets | Monthly category budgets | unique `(user_id, category_id, month)` |
| transactions | Ledger | never edited: `status` posted → reversed, mirror row `status=reversal` with `reverses_id`; `search` tsvector |
| savings_goals / savings_contributions | Goals and money added | `is_protected` goals are excluded from spendable money |
| bills / subscriptions / debts | Commitments | reserved from safe-to-spend until paid |
| inbox_items | Quick captures | `client_id` unique per user for idempotent offline saves; `search` tsvector |
| notes | Notes, ideas, contacts, lists, documents | `related_ids`, `pinned`, `search` |
| tasks / events | Schedule | `recurrence` jsonb `{frequency, interval, days, until}`; `reminder_offsets int[]` minutes |
| reminders / notifications / notification_preferences | Three levels: gentle, important, persistent | persistent stays until acknowledged |
| routines | Reusable routines and time blocks | `steps` jsonb |
| habits / habit_logs | Habits incl. medicines | unique `(user_id, habit_id, log_date)` |
| daily_reviews | Morning plan and evening review | unique `(user_id, review_date, kind)`; `summary` jsonb is deterministic |
| attachments | Metadata for private Storage objects | objects live at `private/<user_id>/<id>-<name>`; signed URLs only |
| audit_events | Before/after for financial tables | append-only |

Storage bucket `private` has per-folder policies keyed on the first path segment (`user_id`).

`public.delete_my_data()` (security definer) deletes every row and storage object for the calling user. The app calls it only after a typed confirmation.

## Sync model

The browser holds a full copy in IndexedDB (Dexie). Writes are applied locally, then queued in an outbox keyed `table:id:op:updated_at` (idempotent). A background loop upserts/deletes on Supabase and pulls rows with `updated_at > cursor`. Conflicts resolve by newest `updated_at`; local newer rows are pushed, not overwritten.
