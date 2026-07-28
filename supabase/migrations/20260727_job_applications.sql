-- Job applications: one row per role you apply to, scoped per-user and
-- per-workspace like everything else. Tracks the position, pay,
-- description, link, and where the application currently stands. Run this
-- in the Supabase SQL editor (or via `supabase db push`).
create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workspace text not null default 'personal',
  position_title text not null,
  company text,
  -- Pay is free text on purpose: "$120k", "$45/hr", "80–100k", "TBD".
  pay text,
  description text,
  url text,
  -- Where it stands. Kept as text (validated in the UI) so new stages can
  -- be added without a migration; see JobStatus in lib/types.ts.
  status text not null default 'applied',
  applied_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.job_applications enable row level security;

drop policy if exists "Users manage their own job applications" on public.job_applications;
create policy "Users manage their own job applications" on public.job_applications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists job_applications_user_workspace_idx
  on public.job_applications (user_id, workspace, applied_date desc);
