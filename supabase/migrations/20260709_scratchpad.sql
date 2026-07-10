-- Scratchpad: per-user, per-workspace to-dos and notes.
-- Run this in the Supabase SQL editor (or via `supabase db push`).

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workspace text not null default 'personal',
  text text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.todos enable row level security;

create policy "Users manage their own todos" on public.todos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists todos_user_workspace_idx
  on public.todos (user_id, workspace);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workspace text not null default 'personal',
  content text not null default '',
  updated_at timestamptz not null default now(),
  unique (user_id, workspace)
);

alter table public.notes enable row level security;

create policy "Users manage their own notes" on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
