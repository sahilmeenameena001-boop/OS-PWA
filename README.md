# My Life OS

A calm, installable personal command centre: **Today**, **Quick Capture**, **Calendar**, **Money & Savings**, **Habits**, **Memory**, **Vault**. Built for one person, with short-term memory in mind: capture first, sort later, never lose anything.

## Stack

- Next.js 15 (App Router), TypeScript strict, Tailwind v4, shadcn/ui (base-ui), custom inline SVG icons
- Supabase Auth / Postgres / private Storage with row-level security
- Local-first data: Dexie (IndexedDB) is the source of truth on device; an outbox syncs to Supabase when online
- Zustand only for transient UI state; vitest for critical logic

## Run

```bash
npm install
cp .env.example .env.local   # optional: add Supabase keys
npm run dev
```

Without Supabase keys the app runs in **local mode**: it starts empty, walks you through onboarding, and keeps everything in that browser only. For a team, configure Supabase so each person signs in to their own account; row-level security keeps every account's data private.

With keys set, sign in at `/login` (password or magic link). New accounts get a profile automatically (database trigger) and go through onboarding.

## Verify

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Supabase setup

1. Create a project, then run `supabase/migrations/20260906000000_init.sql` in the SQL editor (or `supabase db push`).
2. Auth → URL configuration: add your site URL and `https://<site>/auth/callback`.
3. Copy the project URL and anon key into `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=
```

4. Optional: run `supabase/tests/rls_isolation.sql` against the database to verify isolation.

See `docs/schema.md` for table notes.

## Deploy

Any Node host works (Vercel is the simplest): set the three env vars, build with `npm run build`. The service worker (`public/sw.js`) caches the shell and only registers in production. Install from the browser menu or the in-app prompt.

## Architecture notes

- `src/lib/data/repo.ts` — every write goes to IndexedDB, an audit row (financial tables), and the outbox.
- `src/lib/sync/engine.ts` — push outbox, pull by `updated_at` cursor, reconcile deletes.
- `src/lib/money/safe-to-spend.ts` — pure calculations (tested).
- `src/lib/money/ledger.ts` — financial records are never edited; corrections reverse and re-post.
- `src/lib/schedule/recurrence.ts` — recurrence rules (tested), `day.ts` expands them per day.
- `src/lib/notifications/scheduler.ts` — three levels; in-app centre always, browser only after permission.
- `src/lib/ai/adapter.ts` — `AIAdapter` seam with a disabled mock. No external AI in V1.

## Keyboard

`C` opens Quick Capture, `⌘/Ctrl K` opens search and commands.
