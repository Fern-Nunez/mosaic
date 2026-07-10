-- Rebuild money-related tables from scratch.
-- WARNING: drops all existing money + accounts rows. Non-money tables
-- (nutrition, gym, weight, journal, todos, notes) are untouched.

drop table if exists public.subscriptions cascade;
drop table if exists public.money cascade;
drop table if exists public.accounts cascade;

-- Shared trigger for keeping updated_at fresh.
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------- accounts ----------
-- Your cards, checking accounts, cash, etc.
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,                          -- "Chase Freedom Unlimited"
  account_type text not null check (
    account_type in ('credit_card', 'checking', 'savings', 'debit', 'cash', 'investment')
  ),
  institution text,                            -- "Chase", "Robinhood"
  last_four text,                              -- "9716"
  credit_limit numeric(12,2),                  -- null for non-credit accounts
  credit_used numeric(12,2) not null default 0, -- current balance owed on a card
  payment_due_date date,                       -- next payment due
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.accounts enable row level security;

create policy "Users manage their own accounts" on public.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

-- ---------- transactions ----------
-- Every income + expense.
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  date date not null default current_date,     -- when it happened
  amount numeric(12,2) not null,
  transaction_type text not null check (transaction_type in ('income', 'expense')),
  category text,                               -- free-form: "Food", "Gas", "Rent"
  payment_method text,                         -- free-form: "zelle", "credit_card", "cash"
  description text,
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;

create policy "Users manage their own transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index transactions_user_date_idx on public.transactions (user_id, date desc);
create index transactions_account_idx on public.transactions (account_id);

-- ---------- subscriptions ----------
-- Recurring bills. `due_date` is the *next* charge; update it after
-- each billing (or later add a trigger from transactions).
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  name text not null,                          -- "Netflix", "iCloud"
  amount numeric(12,2) not null,
  billing_cycle text not null check (
    billing_cycle in ('weekly', 'monthly', 'quarterly', 'yearly')
  ),
  category text,
  due_date date,                               -- next billing date
  is_active boolean not null default true,     -- flip to false when canceled
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "Users manage their own subscriptions" on public.subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index subscriptions_user_idx on public.subscriptions (user_id);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();
