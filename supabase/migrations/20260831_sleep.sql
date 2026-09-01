-- Sleep tracking.
--
-- Mirrors personal_weight: one row per entry, scoped by user_id + workspace,
-- keyed by a date string so it lines up with every other series on the
-- overview chart.
--
-- Run this in the Supabase SQL editor before using the Sleep tab.

create table if not exists public.sleep (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workspace text not null default 'personal',

  date date not null,
  -- Whatever your tracker calls a sleep score, 0-100. Nullable: plenty of
  -- nights you know how long you slept and nothing more.
  score smallint check (score is null or (score >= 0 and score <= 100)),
  -- Time actually asleep, in hours. 6.5 = six and a half.
  hours numeric(4, 2) check (hours is null or (hours >= 0 and hours <= 24)),

  bedtime time,
  wake_time time,
  notes text,

  created_at timestamptz not null default now()
);

-- One entry per night.
create unique index if not exists sleep_user_workspace_date_idx
  on public.sleep (user_id, workspace, date);

-- The chart reads a date range per user; this is the index that serves it.
create index if not exists sleep_user_date_idx
  on public.sleep (user_id, date desc);

alter table public.sleep enable row level security;

drop policy if exists "Users manage their own sleep" on public.sleep;
create policy "Users manage their own sleep" on public.sleep
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
