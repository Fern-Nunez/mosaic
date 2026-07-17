-- Per-user settings, starting with each user's own OpenAI API key so
-- meal photo analysis bills their account, not the app owner's.
-- The key is encrypted server-side (AES-256-GCM) before it's stored;
-- key_hint holds the last 4 characters for display only.

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  openai_api_key text,
  key_hint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "Users manage their own settings" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();
