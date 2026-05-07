-- Streak day 1 = account creation date only. Onboarding answers (days before created_at) never count.
-- Replaces use of onboarding_completed_at so that "dag van aanmaak = dag 1" is consistent.

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
  -- Day 1 = account creation date (profiles.created_at or auth.users.created_at) in user tz.
  -- Answers before day_one (e.g. onboarding flow) do not count toward streak.
  select coalesce(
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
  'Returns visual_streak and real_streak. Streak day 1 = account creation date (profiles.created_at::date); answers before that (e.g. onboarding) do not count.';
grant execute on function public.get_user_streaks(uuid, text) to authenticated;
grant execute on function public.get_user_streaks(uuid, text) to service_role;
