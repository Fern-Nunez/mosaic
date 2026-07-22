-- Daily habits: per-user, per-workspace habit definitions plus a log of
-- which habit was completed on which day. Run this in the Supabase SQL
-- editor (or via `supabase db push`).

-- The habits themselves (name + chosen icon key). "position" keeps the
-- dots in the order they were added.
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workspace text not null default 'personal',
  name text not null,
  icon text not null default 'droplet',
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.habits enable row level security;

drop policy if exists "Users manage their own habits" on public.habits;
create policy "Users manage their own habits" on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists habits_user_workspace_idx
  on public.habits (user_id, workspace);

-- One row per (habit, day) it was completed. Deleting a habit removes
-- its completions; the unique constraint makes marking a day idempotent.
create table if not exists public.habit_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workspace text not null default 'personal',
  habit_id uuid not null references public.habits (id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  unique (habit_id, date)
);

alter table public.habit_completions enable row level security;

drop policy if exists "Users manage their own habit completions" on public.habit_completions;
create policy "Users manage their own habit completions" on public.habit_completions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists habit_completions_user_workspace_date_idx
  on public.habit_completions (user_id, workspace, date);

-- Embedded Google Calendar links, kept per-dashboard as a JSON map of
-- { "<workspace-id>": ["<embed-url>", …] } on the existing settings row.
alter table public.user_settings
  add column if not exists calendars jsonb not null default '{}'::jsonb;
