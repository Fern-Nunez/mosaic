-- Sidebar pages each user has switched off in Settings.
--
-- Stored on user_settings so the choice follows you across devices. Holds
-- view ids from components/dashboard/views.ts ("gym", "jobs", ...); Overview
-- can't be hidden, so it never appears here.
--
-- Run this in the Supabase SQL editor before using Settings > Sidebar.

alter table public.user_settings
  add column if not exists hidden_views text[] not null default '{}';

notify pgrst, 'reload schema';
