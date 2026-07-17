-- Per-user daily nutrition goals. These are the targets the nutrition
-- bars fill toward. Stored on user_settings alongside the OpenAI key so
-- there's still one row per user, and so they sync across devices.
-- Defaults are a lean-bulk starting point (surplus + high protein); the
-- user can change any of them from the dashboard.

alter table public.user_settings
  add column if not exists calorie_goal integer not null default 2800,
  add column if not exists protein_goal integer not null default 160,
  add column if not exists carb_goal integer not null default 380,
  add column if not exists fat_goal integer not null default 70;
