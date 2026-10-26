-- One row per device that turned on notifications in More → Notifications.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  -- The phone's time zone, so "today" and the reminder match where you are.
  timezone text not null default 'America/Los_Angeles',
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "Own push subscriptions: read" on public.push_subscriptions
  for select using (auth.uid() = user_id);
create policy "Own push subscriptions: add" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);
create policy "Own push subscriptions: update" on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own push subscriptions: remove" on public.push_subscriptions
  for delete using (auth.uid() = user_id);
