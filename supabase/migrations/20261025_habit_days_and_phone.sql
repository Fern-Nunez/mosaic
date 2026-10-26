-- 1. Repeating tasks: which weekdays a habit is due.
--    0 = Sunday … 6 = Saturday. Null means every day (all existing habits).
alter table public.habits
  add column if not exists days smallint[]
  check (days is null or days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]);

-- 2. Phone number, saved from Settings for texting features later.
--    Stored as +1XXXXXXXXXX.
alter table public.user_settings
  add column if not exists phone_number text;
