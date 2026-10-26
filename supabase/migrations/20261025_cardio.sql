-- Bike rides and swims. Runs keep their own table (the running leaderboard
-- reads it), so other cardio lives here. Same pattern as the other tables:
-- per-user, per-workspace, keyed by a date string.
--
-- Run this in the Supabase SQL editor before logging a ride or swim.

create table if not exists public.cardio (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workspace text not null default 'personal',

  date date not null,
  activity text not null check (activity in ('bike', 'swim')),
  -- Rides in miles (or km); swims in yards or meters.
  distance numeric(8, 2) check (distance is null or distance > 0),
  distance_unit text check (distance_unit is null or distance_unit in ('mi', 'km', 'yd', 'm')),
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  notes text,

  created_at timestamptz not null default now(),

  -- A session needs at least a distance or a time.
  check (distance is not null or duration_seconds is not null)
);

create index if not exists cardio_user_workspace_date_idx
  on public.cardio (user_id, workspace, date desc);

alter table public.cardio enable row level security;

drop policy if exists "Users manage their own cardio" on public.cardio;
create policy "Users manage their own cardio" on public.cardio
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
