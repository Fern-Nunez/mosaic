-- Per-dashboard (workspace) data separation. Every data table gets a
-- workspace tag so "Personal" and e.g. "Business" dashboards keep fully
-- separate money, nutrition, gym, weight, and journal data. Existing rows
-- all default to 'personal', so nothing moves or disappears.
--
-- The list of dashboards itself lives on user_settings (jsonb) so it
-- syncs across devices instead of living only in one browser's storage.

alter table public.transactions
  add column if not exists workspace text not null default 'personal';
alter table public.accounts
  add column if not exists workspace text not null default 'personal';
alter table public.subscriptions
  add column if not exists workspace text not null default 'personal';
alter table public.nutrition
  add column if not exists workspace text not null default 'personal';
alter table public.gym_weight
  add column if not exists workspace text not null default 'personal';
alter table public.journal
  add column if not exists workspace text not null default 'personal';
alter table public.personal_weight
  add column if not exists workspace text not null default 'personal';

create index if not exists transactions_user_workspace_idx
  on public.transactions (user_id, workspace);
create index if not exists accounts_user_workspace_idx
  on public.accounts (user_id, workspace);
create index if not exists subscriptions_user_workspace_idx
  on public.subscriptions (user_id, workspace);
create index if not exists nutrition_user_workspace_idx
  on public.nutrition (user_id, workspace);
create index if not exists gym_weight_user_workspace_idx
  on public.gym_weight (user_id, workspace);
create index if not exists journal_user_workspace_idx
  on public.journal (user_id, workspace);
create index if not exists personal_weight_user_workspace_idx
  on public.personal_weight (user_id, workspace);

-- The user's dashboards, e.g. [{"id":"personal","name":"Personal"},
-- {"id":"<uuid>","name":"Business"}].
alter table public.user_settings
  add column if not exists workspaces jsonb not null
    default '[{"id":"personal","name":"Personal"}]'::jsonb;

-- Recreate the subscription catch-up so generated transactions land in
-- the same dashboard as their subscription.
create or replace function public.advance_due_subscriptions()
returns integer
language plpgsql
security invoker
as $$
declare
  sub record;
  cursor_date date;
  method text;
  advanced integer := 0;
begin
  for sub in
    select id, user_id, account_id, name, amount, billing_cycle,
           category, due_date, workspace
    from public.subscriptions
    where is_active
      and due_date is not null
      and due_date <= current_date
      and user_id = auth.uid()
  loop
    -- Inherit the payment method from the account when we can.
    select account_type into method
    from public.accounts
    where id = sub.account_id;

    cursor_date := sub.due_date;

    while cursor_date <= current_date loop
      insert into public.transactions (
        user_id, account_id, date, amount,
        transaction_type, category, payment_method, description, workspace
      )
      values (
        sub.user_id, sub.account_id, cursor_date, sub.amount,
        'expense', sub.category, method, sub.name, sub.workspace
      );

      cursor_date := case sub.billing_cycle
        when 'weekly'    then cursor_date + interval '1 week'
        when 'monthly'   then cursor_date + interval '1 month'
        when 'quarterly' then cursor_date + interval '3 months'
        when 'yearly'    then cursor_date + interval '1 year'
      end;

      advanced := advanced + 1;
    end loop;

    update public.subscriptions
    set due_date = cursor_date
    where id = sub.id;
  end loop;

  return advanced;
end;
$$;
