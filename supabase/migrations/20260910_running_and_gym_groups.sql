-- Running log, plus gym groups with a shared leaderboard.
--
-- Run this in the Supabase SQL editor before using Gym > Running or
-- Gym > Leaderboard.
--
-- Privacy model: nobody can read another user's gym_weight or runs rows.
-- Groups only ever see the aggregates returned by gym_group_leaderboard(),
-- which checks membership itself.

-- ---------- Runs ----------

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workspace text not null default 'personal',

  date date not null,
  distance_miles numeric(6, 2) not null check (distance_miles > 0),
  duration_seconds integer not null check (duration_seconds > 0),

  created_at timestamptz not null default now()
);

create index if not exists runs_user_date_idx
  on public.runs (user_id, date desc);

alter table public.runs enable row level security;

drop policy if exists "Users manage their own runs" on public.runs;
create policy "Users manage their own runs" on public.runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Groups ----------

create table if not exists public.gym_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  code text not null unique,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- One row per person per group. The nickname is per group, so different
-- groups can know you by different names.
create table if not exists public.gym_group_members (
  group_id uuid not null references public.gym_groups (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 40),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists gym_group_members_user_idx
  on public.gym_group_members (user_id);

alter table public.gym_groups enable row level security;
alter table public.gym_group_members enable row level security;

-- Security definer so policies can ask "am I in this group?" without
-- recursing through gym_group_members' own policy.
create or replace function public.is_gym_group_member(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from gym_group_members
    where group_id = gid and user_id = auth.uid()
  )
$$;

drop policy if exists "Members see their groups" on public.gym_groups;
create policy "Members see their groups" on public.gym_groups
  for select using (public.is_gym_group_member(id));

drop policy if exists "Creators delete their groups" on public.gym_groups;
create policy "Creators delete their groups" on public.gym_groups
  for delete using (created_by = auth.uid());

drop policy if exists "Members see each other" on public.gym_group_members;
create policy "Members see each other" on public.gym_group_members
  for select using (public.is_gym_group_member(group_id));

-- Leave a group yourself, or remove someone from a group you created.
drop policy if exists "Leave or remove members" on public.gym_group_members;
create policy "Leave or remove members" on public.gym_group_members
  for delete using (
    user_id = auth.uid()
    or exists (
      select 1 from public.gym_groups g
      where g.id = group_id and g.created_by = auth.uid()
    )
  );

-- No insert/update policies: creating and joining go through the functions
-- below, so a group can only be joined by someone who knows its code.

create or replace function public.create_gym_group(p_name text, p_nickname text)
returns public.gym_groups
language plpgsql
security definer
set search_path = public
as $$
declare
  -- No 0/O or 1/I, so codes survive being read out loud.
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
  g public.gym_groups;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  loop
    new_code := '';
    for i in 1..6 loop
      new_code := new_code
        || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from gym_groups where code = new_code);
  end loop;

  insert into gym_groups (name, code, created_by)
  values (trim(p_name), new_code, auth.uid())
  returning * into g;

  insert into gym_group_members (group_id, user_id, nickname)
  values (g.id, auth.uid(), trim(p_nickname));

  return g;
end;
$$;

create or replace function public.join_gym_group(p_code text, p_nickname text)
returns public.gym_groups
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.gym_groups;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into g from gym_groups where code = upper(trim(p_code));
  if not found then
    raise exception 'No group with that code';
  end if;

  -- Joining again just updates your nickname.
  insert into gym_group_members (group_id, user_id, nickname)
  values (g.id, auth.uid(), trim(p_nickname))
  on conflict (group_id, user_id) do update set nickname = excluded.nickname;

  return g;
end;
$$;

-- ---------- Leaderboard ----------

-- Everyone's bests in one group, one row per (member, stat). Returns nothing
-- unless the caller is a member. Lifts count across every workspace; kg is
-- converted to lbs so the group ranks on one scale.
--
--   lift_max        heaviest weight per exercise, lbs
--   lift_1rm        best estimated 1-rep max per exercise (Epley, <=12 reps)
--   bw_reps         most reps in a set, bodyweight exercises
--   workouts_week   distinct lifting days since Monday
--   miles_month     running miles since the 1st
--   run_longest     longest single run, miles
--   run_pace        fastest average pace on a run of 1+ mile, seconds/mile
create or replace function public.gym_group_leaderboard(p_group uuid)
returns table (
  user_id uuid,
  nickname text,
  kind text,
  key text,
  label text,
  value numeric
)
language sql
security definer
stable
set search_path = public
as $$
  with members as (
    select m.user_id, m.nickname
    from gym_group_members m
    where m.group_id = p_group and is_gym_group_member(p_group)
  ),
  lifts as (
    select
      g.user_id,
      lower(trim(g.exercise)) as ex_key,
      trim(g.exercise) as ex_label,
      g.reps,
      g.unit,
      g.date,
      case when g.unit = 'kg' then g.weight * 2.20462 else g.weight end as lbs
    from gym_weight g
    join members mm on mm.user_id = g.user_id
  ),
  member_runs as (
    select r.user_id, r.date, r.distance_miles, r.duration_seconds
    from runs r
    join members mm on mm.user_id = r.user_id
  ),
  stats as (
    select l.user_id, 'lift_max'::text as kind, l.ex_key as key,
      max(l.ex_label) as label, round(max(l.lbs), 1) as value
    from lifts l
    where l.unit in ('lbs', 'kg') and l.lbs > 0
    group by l.user_id, l.ex_key

    union all
    select l.user_id, 'lift_1rm', l.ex_key, max(l.ex_label),
      round(max(
        case when coalesce(l.reps, 1) <= 1 then l.lbs
             else l.lbs * (1 + l.reps / 30.0) end
      ), 1)
    from lifts l
    where l.unit in ('lbs', 'kg') and l.lbs > 0 and coalesce(l.reps, 1) <= 12
    group by l.user_id, l.ex_key

    union all
    select l.user_id, 'bw_reps', l.ex_key, max(l.ex_label), max(l.reps)
    from lifts l
    where l.unit = 'bodyweight' and l.reps > 0
    group by l.user_id, l.ex_key

    union all
    select l.user_id, 'workouts_week', null, null, count(distinct l.date)
    from lifts l
    where l.date >= date_trunc('week', current_date)
    group by l.user_id

    union all
    select r.user_id, 'miles_month', null, null, round(sum(r.distance_miles), 2)
    from member_runs r
    where r.date >= date_trunc('month', current_date)
    group by r.user_id

    union all
    select r.user_id, 'run_longest', null, null, max(r.distance_miles)
    from member_runs r
    group by r.user_id

    union all
    select r.user_id, 'run_pace', null, null,
      round(min(r.duration_seconds / r.distance_miles))
    from member_runs r
    where r.distance_miles >= 1
    group by r.user_id
  )
  select s.user_id, m.nickname, s.kind, s.key, s.label, s.value
  from stats s
  join members m on m.user_id = s.user_id
$$;

-- Functions are executable by everyone by default; only signed-in users here.
revoke execute on function public.create_gym_group(text, text) from public, anon;
revoke execute on function public.join_gym_group(text, text) from public, anon;
revoke execute on function public.gym_group_leaderboard(uuid) from public, anon;
grant execute on function public.create_gym_group(text, text) to authenticated;
grant execute on function public.join_gym_group(text, text) to authenticated;
grant execute on function public.gym_group_leaderboard(uuid) to authenticated;
