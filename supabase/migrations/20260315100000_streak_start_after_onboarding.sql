-- Streak starts the day onboarding was completed, so onboarding answers (past 7 days)
-- do not inflate the streak. When onboarding_completed_at is set, use it as day_one.

alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.profiles.onboarding_completed_at is
  'When set, streak day 1 is this date (user tz). Answers before this date (e.g. onboarding) do not count.';

-- get_user_streaks: use onboarding_completed_at as day_one when set (else created_at).
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
  day_one date;
begin
  -- Streak day 1 = onboarding_completed_at::date when set (so onboarding answers don't count);
  -- otherwise profiles.created_at::date; fallback to auth.users.
  select coalesce(
    (select (p.onboarding_completed_at at time zone tz)::date from public.profiles p where p.id = p_user_id and p.onboarding_completed_at is not null),
    (select (p.created_at at time zone tz)::date from public.profiles p where p.id = p_user_id),
    (select (u.created_at at time zone tz)::date from auth.users u where u.id = p_user_id)
  ) into day_one;

  if day_one is null then
    day_one := '1970-01-01'::date;
  end if;

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
  'Returns visual_streak and real_streak. Streak day 1 = onboarding_completed_at::date when set (ignores onboarding answers), else profiles.created_at::date.';

grant execute on function public.get_user_streaks(uuid, text) to authenticated;
grant execute on function public.get_user_streaks(uuid, text) to service_role;
