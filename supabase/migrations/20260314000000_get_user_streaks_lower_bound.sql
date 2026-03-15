-- Ensure profiles.created_at exists (streak day 1 boundary).
alter table public.profiles
  add column if not exists created_at timestamptz;

-- Backfill from auth.users so existing profiles have a creation date.
update public.profiles p
set created_at = u.created_at
from auth.users u
where p.id = u.id and p.created_at is null;

-- Default for new profile rows (e.g. from trigger).
alter table public.profiles
  alter column created_at set default now();

-- get_user_streaks: add lower bound so streak day 1 = profiles.created_at::date.
-- Only answers with question_date >= profiles.created_at::date (in user tz) count.
-- Prevents historical/onboarding answers before account creation from inflating streak.

create or replace function public.get_user_streaks(p_user_id uuid, p_timezone text default 'UTC')
returns table (visual_streak bigint, real_streak bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  tz text := coalesce(nullif(trim(p_timezone), ''), 'UTC');
  today_local date := (now() at time zone tz)::date;
  ref_date date;
  streak_count bigint := 0;
  d date;
  has_ans boolean;
  has_today boolean;
  day_one date;  -- streak starts at profiles.created_at::date (user tz)
begin
  -- Day 1 = profiles.created_at::date in user's timezone. Fallback to auth.users if profile has no created_at.
  select coalesce(
    (select (p.created_at at time zone tz)::date from public.profiles p where p.id = p_user_id),
    (select (u.created_at at time zone tz)::date from auth.users u where u.id = p_user_id)
  ) into day_one;

  -- If we have no creation date, treat as no lower bound (legacy behavior).
  if day_one is null then
    day_one := '1970-01-01'::date;
  end if;

  -- If user has answered today, count from today; otherwise from yesterday (streak "ends" at last closed day).
  -- Only count answers on or after day_one.
  select exists (
    select 1 from public.answers a
    where a.user_id = p_user_id and a.question_date = today_local and a.question_date >= day_one
  ) into has_today;

  if has_today then
    ref_date := today_local;
  else
    ref_date := today_local - 1;
  end if;

  d := ref_date;
  loop
    -- Only count answers with question_date >= day_one; stop when we go before day_one.
    exit when d < day_one;
    select exists (
      select 1
      from public.answers a
      where a.user_id = p_user_id and a.question_date = d and a.question_date >= day_one
    ) into has_ans;
    exit when not has_ans;
    streak_count := streak_count + 1;
    d := d - 1;
  end loop;

  visual_streak := streak_count;
  real_streak := streak_count;
  return next;
end;
$$;

comment on function public.get_user_streaks(uuid, text) is
  'Returns visual_streak and real_streak: consecutive days with answers. If user answered today (in p_timezone), today is included; else count ends at yesterday. Streak day 1 = profiles.created_at::date; answers before that are ignored.';

grant execute on function public.get_user_streaks(uuid, text) to authenticated;
grant execute on function public.get_user_streaks(uuid, text) to service_role;
