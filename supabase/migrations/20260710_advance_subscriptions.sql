-- Auto-advance subscriptions: for each active subscription whose
-- due_date has passed, insert a matching expense transaction and
-- advance the due_date. Loops through missed cycles so several
-- missed months all get caught up in one call.
--
-- Runs as the caller (security invoker) so RLS applies naturally:
-- users only touch their own rows via auth.uid().
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
           category, due_date
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
        transaction_type, category, payment_method, description
      )
      values (
        sub.user_id, sub.account_id, cursor_date, sub.amount,
        'expense', sub.category, method, sub.name
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

grant execute on function public.advance_due_subscriptions() to authenticated;
