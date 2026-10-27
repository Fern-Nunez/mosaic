-- Lets you edit and delete your own entries from the section pages.
-- Safe to run more than once, and safe if these tables already allow it:
-- Postgres ORs policies together, so this only ever adds "your own rows".

do $$
declare
  t text;
begin
  foreach t in array array[
    'nutrition', 'gym_weight', 'runs', 'cardio', 'sleep',
    'personal_weight', 'journal', 'supplement_logs'
  ] loop
    if to_regclass('public.' || t) is null then
      continue; -- table not created yet
    end if;
    execute format('drop policy if exists %I on public.%I', 'Own rows: edit', t);
    execute format('drop policy if exists %I on public.%I', 'Own rows: delete', t);
    execute format(
      'create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      'Own rows: edit', t
    );
    execute format(
      'create policy %I on public.%I for delete using (auth.uid() = user_id)',
      'Own rows: delete', t
    );
  end loop;
end $$;
