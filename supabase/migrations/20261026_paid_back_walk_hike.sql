-- 1. "Paid back" money: someone sends you money (Zelle, Venmo, cash) for
--    something you already logged as an expense. Lowers spending instead
--    of counting as income. Stored as transaction_type = 'reimbursement'.
-- 2. Walks and hikes, alongside rides and swims.
--
-- Drops whatever check currently limits those columns (whatever it's
-- named), then adds the wider one. Safe to run more than once.

do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.transactions'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%transaction_type%'
  loop
    execute format('alter table public.transactions drop constraint %I', c.conname);
  end loop;

  for c in
    select conname from pg_constraint
    where conrelid = 'public.cardio'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%activity%'
  loop
    execute format('alter table public.cardio drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.transactions add constraint transactions_transaction_type_check
  check (transaction_type in ('income', 'expense', 'reimbursement'));

alter table public.cardio add constraint cardio_activity_check
  check (activity in ('bike', 'swim', 'walk', 'hike'));

-- Editing and deleting transactions needs nothing new: the existing
-- "Users manage their own transactions" policy already covers it.
