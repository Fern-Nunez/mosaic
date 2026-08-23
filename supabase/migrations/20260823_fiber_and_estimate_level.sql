-- Fiber tracking, plus moving the AI estimate level out of the meal-photo
-- flow and into the user's saved nutrition goals.
--
-- fiber sits alongside the other macros on each logged meal, and
-- fiber_goal alongside the other daily targets. estimate_level is the
-- low/middle/high bias the meal analyzer applies to ambiguous portions;
-- it used to be picked per photo, now it's a setting chosen once.

alter table public.nutrition
  add column if not exists fiber numeric;

alter table public.user_settings
  add column if not exists fiber_goal integer not null default 30,
  add column if not exists estimate_level text not null default 'low';

-- Guard the enum-ish column without a hard enum type, so adding a level
-- later is a one-line change.
do $$
begin
  alter table public.user_settings
    add constraint user_settings_estimate_level_check
    check (estimate_level in ('low', 'middle', 'high'));
exception
  when duplicate_object then null;
end
$$;
