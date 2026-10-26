-- Settings from the gear menu on each Trends page (budget, workout goal,
-- goal weight, sleep goal, journal privacy). One JSON object per user.
alter table public.user_settings
  add column if not exists app_prefs jsonb not null default '{}'::jsonb;
