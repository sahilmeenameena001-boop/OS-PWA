-- My Life OS — initial schema. Single-user app, but every private table is scoped by user_id + RLS.
create extension if not exists "pgcrypto";

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- array_to_string is only STABLE, which generated columns reject; this wrapper is safe for text[].
create or replace function public.tags_text(text[]) returns text language sql immutable parallel safe as $$
  select coalesce(array_to_string($1, ' '), '')
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'Asia/Kolkata',
  currency text not null default 'INR',
  monthly_income numeric(14,2) not null default 0,
  income_day smallint not null default 1 check (income_day between 1 and 31),
  opening_balance numeric(14,2) not null default 0,
  protected_savings_min numeric(14,2) not null default 0,
  daily_limit numeric(14,2),
  weekly_limit numeric(14,2),
  onboarding_completed boolean not null default false,
  theme text not null default 'system' check (theme in ('system','dark','light')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('cash','bank','card','upi')),
  opening_balance numeric(14,2) not null default 0,
  currency text not null default 'INR',
  is_archived boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default 'tag',
  color text not null default 'blue',
  is_essential boolean not null default false,
  sort_order int not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.expense_categories(id) on delete cascade,
  month date not null,
  amount numeric(14,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category_id, month)
);

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null check (target_amount >= 0),
  deadline date,
  is_protected boolean not null default true,
  is_emergency_fund boolean not null default false,
  color text not null default 'mint',
  status text not null default 'active' check (status in ('active','completed','paused')),
  planned_monthly numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('expense','income','transfer','contribution','repayment')),
  amount numeric(14,2) not null check (amount >= 0),
  account_id uuid references public.accounts(id) on delete set null,
  to_account_id uuid references public.accounts(id) on delete set null,
  category_id uuid references public.expense_categories(id) on delete set null,
  merchant text,
  note text,
  occurred_on date not null,
  occurred_at timestamptz not null default now(),
  receipt_attachment_id uuid,
  status text not null default 'posted' check (status in ('posted','reversed','reversal')),
  reverses_id uuid references public.transactions(id) on delete set null,
  reversed_by_id uuid references public.transactions(id) on delete set null,
  is_discretionary boolean not null default true,
  source text not null default 'manual',
  linked_type text,
  linked_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.savings_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  amount numeric(14,2) not null,
  contributed_on date not null,
  transaction_id uuid references public.transactions(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(14,2) not null check (amount >= 0),
  frequency text not null default 'monthly' check (frequency in ('monthly','weekly','yearly','once')),
  next_due_on date not null,
  category_id uuid references public.expense_categories(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  is_fixed boolean not null default true,
  last_paid_on date,
  status text not null default 'active' check (status in ('active','paused','ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(14,2) not null check (amount >= 0),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly','yearly','weekly')),
  next_billing_on date not null,
  category_id uuid references public.expense_categories(id) on delete set null,
  is_essential boolean not null default false,
  status text not null default 'active' check (status in ('active','paused','cancelled')),
  started_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  lender text,
  principal numeric(14,2) not null default 0,
  remaining numeric(14,2) not null default 0,
  monthly_payment numeric(14,2) not null default 0,
  due_day smallint check (due_day between 1 and 31),
  status text not null default 'active' check (status in ('active','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null default 'private',
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  kind text not null default 'file' check (kind in ('receipt','document','photo','file')),
  title text,
  tags text[] not null default '{}',
  linked_type text,
  linked_id uuid,
  is_vault boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  content text not null default '',
  kind text not null default 'text' check (kind in ('text','voice','photo','file','link')),
  url text,
  attachment_id uuid references public.attachments(id) on delete set null,
  captured_at timestamptz not null default now(),
  scheduled_for timestamptz,
  status text not null default 'unprocessed' check (status in ('unprocessed','classified','archived','deleted')),
  classified_as text,
  linked_type text,
  linked_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  body text not null default '',
  kind text not null default 'note' check (kind in ('note','idea','contact','shopping','document')),
  tags text[] not null default '{}',
  pinned boolean not null default false,
  source_inbox_id uuid,
  related_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  kind text not null default 'custom' check (kind in ('morning','evening','custom','time_block')),
  steps jsonb not null default '[]',
  days smallint[] not null default '{0,1,2,3,4,5,6}',
  start_time time,
  duration_min int not null default 30,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo','doing','done','skipped','postponed')),
  priority smallint not null default 3 check (priority between 1 and 4),
  category text,
  due_on date,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  completed_at timestamptz,
  recurrence jsonb,
  reminder_offsets int[] not null default '{}',
  routine_id uuid references public.routines(id) on delete set null,
  is_top_priority boolean not null default false,
  sort_order int not null default 0,
  source_inbox_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  location text,
  category text,
  recurrence jsonb,
  reminder_offsets int[] not null default '{}',
  status text not null default 'scheduled' check (status in ('scheduled','done','skipped','postponed','cancelled')),
  source_inbox_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  remind_at timestamptz not null,
  level text not null default 'gentle' check (level in ('gentle','important','persistent')),
  status text not null default 'pending' check (status in ('pending','sent','acknowledged','snoozed','dismissed')),
  snoozed_until timestamptz,
  linked_type text,
  linked_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null default 'habit' check (kind in ('habit','medicine','exercise','water','sleep','rehab')),
  schedule_days smallint[] not null default '{0,1,2,3,4,5,6}',
  times text[] not null default '{}',
  target_per_day int not null default 1,
  unit text,
  is_essential boolean not null default false,
  color text not null default 'mint',
  notes text,
  is_active boolean not null default true,
  reminder_level text not null default 'gentle' check (reminder_level in ('gentle','important','persistent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  log_date date not null,
  status text not null default 'done' check (status in ('done','skipped','missed')),
  value numeric(10,2),
  note text,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, habit_id, log_date)
);

create table if not exists public.daily_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  review_date date not null,
  kind text not null check (kind in ('morning','evening')),
  top_priorities text[] not null default '{}',
  intention text,
  went_well text,
  to_improve text,
  mood smallint check (mood between 1 and 5),
  energy smallint check (energy between 1 and 5),
  summary jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, review_date, kind)
);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  browser_enabled boolean not null default false,
  quiet_hours_start time,
  quiet_hours_end time,
  gentle_enabled boolean not null default true,
  important_enabled boolean not null default true,
  persistent_enabled boolean not null default true,
  default_offsets int[] not null default '{10}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  level text not null default 'gentle' check (level in ('gentle','important','persistent')),
  status text not null default 'unread' check (status in ('unread','read','acknowledged')),
  fire_at timestamptz not null default now(),
  linked_type text,
  linked_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  action text not null check (action in ('create','update','delete','reverse')),
  before jsonb,
  after jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- indexes
create index if not exists accounts_user_id_idx on public.accounts (user_id);
create index if not exists expense_categories_user_id_idx on public.expense_categories (user_id);
create index if not exists budgets_user_id_month_idx on public.budgets (user_id, month);
create index if not exists savings_goals_user_id_status_idx on public.savings_goals (user_id, status);
create index if not exists transactions_user_id_occurred_on_idx on public.transactions (user_id, occurred_on desc);
create index if not exists transactions_user_id_category_id_idx on public.transactions (user_id, category_id);
create index if not exists transactions_user_id_status_idx on public.transactions (user_id, status);
create index if not exists savings_contributions_user_id_goal_id_idx on public.savings_contributions (user_id, goal_id);
create index if not exists bills_user_id_next_due_on_idx on public.bills (user_id, next_due_on);
create index if not exists subscriptions_user_id_next_billing_on_idx on public.subscriptions (user_id, next_billing_on);
create index if not exists debts_user_id_status_idx on public.debts (user_id, status);
create index if not exists attachments_user_id_created_at_idx on public.attachments (user_id, created_at desc);
create index if not exists inbox_items_user_id_status_captured_at_idx on public.inbox_items (user_id, status, captured_at desc);
create index if not exists notes_user_id_created_at_idx on public.notes (user_id, created_at desc);
create index if not exists notes_user_id_pinned_idx on public.notes (user_id, pinned);
create index if not exists tasks_user_id_status_due_on_idx on public.tasks (user_id, status, due_on);
create index if not exists tasks_user_id_scheduled_start_idx on public.tasks (user_id, scheduled_start);
create index if not exists events_user_id_start_at_idx on public.events (user_id, start_at);
create index if not exists reminders_user_id_status_remind_at_idx on public.reminders (user_id, status, remind_at);
create index if not exists routines_user_id_is_active_idx on public.routines (user_id, is_active);
create index if not exists habits_user_id_is_active_idx on public.habits (user_id, is_active);
create index if not exists habit_logs_user_id_log_date_idx on public.habit_logs (user_id, log_date desc);
create index if not exists daily_reviews_user_id_review_date_idx on public.daily_reviews (user_id, review_date desc);
create index if not exists notifications_user_id_status_fire_at_idx on public.notifications (user_id, status, fire_at desc);
create index if not exists audit_events_user_id_entity_type_entity_id_idx on public.audit_events (user_id, entity_type, entity_id);

-- full-text search columns for memory sources
alter table public.notes add column if not exists search tsvector generated always as (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(body,'') || ' ' || public.tags_text(tags))) stored;
create index if not exists notes_search_idx on public.notes using gin (search);
alter table public.inbox_items add column if not exists search tsvector generated always as (to_tsvector('simple', coalesce(content,'') || ' ' || coalesce(url,''))) stored;
create index if not exists inbox_search_idx on public.inbox_items using gin (search);
alter table public.tasks add column if not exists search tsvector generated always as (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,''))) stored;
create index if not exists tasks_search_idx on public.tasks using gin (search);
alter table public.transactions add column if not exists search tsvector generated always as (to_tsvector('simple', coalesce(merchant,'') || ' ' || coalesce(note,''))) stored;
create index if not exists transactions_search_idx on public.transactions using gin (search);
alter table public.attachments add column if not exists search tsvector generated always as (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(file_name,'') || ' ' || public.tags_text(tags))) stored;
create index if not exists attachments_search_idx on public.attachments using gin (search);

-- updated_at triggers + RLS for every private table
do $$
declare t text;
begin
  foreach t in array array['profiles','accounts','expense_categories','budgets','savings_goals','transactions','savings_contributions','bills','subscriptions','debts','attachments','inbox_items','notes','routines','tasks','events','reminders','habits','habit_logs','daily_reviews','notification_preferences','notifications','audit_events']
  loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', t, t);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t, t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t, t);
    execute format('create policy %I_update on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t, t);
    execute format('create policy %I_delete on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t, t);
  end loop;
end $$;

-- audit events are append-only, even for the owner
drop policy if exists audit_events_update on public.audit_events;
drop policy if exists audit_events_delete on public.audit_events;

-- create profile + notification preferences on signup
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, user_id, display_name) values (new.id, new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  insert into public.notification_preferences (user_id) values (new.id);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- full account data deletion, invoked by the app after explicit confirmation
create or replace function public.delete_my_data() returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  delete from public.audit_events where user_id = uid;
  delete from public.notifications where user_id = uid;
  delete from public.habit_logs where user_id = uid;
  delete from public.habits where user_id = uid;
  delete from public.daily_reviews where user_id = uid;
  delete from public.reminders where user_id = uid;
  delete from public.events where user_id = uid;
  delete from public.tasks where user_id = uid;
  delete from public.routines where user_id = uid;
  delete from public.notes where user_id = uid;
  delete from public.inbox_items where user_id = uid;
  delete from public.attachments where user_id = uid;
  delete from public.savings_contributions where user_id = uid;
  delete from public.transactions where user_id = uid;
  delete from public.debts where user_id = uid;
  delete from public.subscriptions where user_id = uid;
  delete from public.bills where user_id = uid;
  delete from public.budgets where user_id = uid;
  delete from public.savings_goals where user_id = uid;
  delete from public.expense_categories where user_id = uid;
  delete from public.accounts where user_id = uid;
  delete from public.notification_preferences where user_id = uid;
  delete from public.profiles where user_id = uid;
  delete from storage.objects where bucket_id = 'private' and (storage.foldername(name))[1] = uid::text;
end $$;

-- private storage bucket: objects live under <user_id>/...
insert into storage.buckets (id, name, public, file_size_limit) values ('private','private', false, 20971520) on conflict (id) do nothing;
drop policy if exists "private_read_own" on storage.objects;
create policy "private_read_own" on storage.objects for select to authenticated using (bucket_id = 'private' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "private_insert_own" on storage.objects;
create policy "private_insert_own" on storage.objects for insert to authenticated with check (bucket_id = 'private' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "private_update_own" on storage.objects;
create policy "private_update_own" on storage.objects for update to authenticated using (bucket_id = 'private' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "private_delete_own" on storage.objects;
create policy "private_delete_own" on storage.objects for delete to authenticated using (bucket_id = 'private' and (storage.foldername(name))[1] = (select auth.uid())::text);
