-- get_user_streaks: if user has answered today (in p_timezone), count from today; else from yesterday.
-- So "3 consecutive days including today" shows as 3, not 2.

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
begin
  -- If user has answered today, count from today; otherwise from yesterday (streak "ends" at last closed day).
  select exists (
    select 1 from public.answers a
    where a.user_id = p_user_id and a.question_date = today_local
  ) into has_today;

  if has_today then
    ref_date := today_local;
  else
    ref_date := today_local - 1;
  end if;

  d := ref_date;
  loop
    select exists (
      select 1
      from public.answers a
      where a.user_id = p_user_id and a.question_date = d
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
  'Returns visual_streak and real_streak: consecutive days with answers. If user answered today (in p_timezone), today is included; else count ends at yesterday.';

grant execute on function public.get_user_streaks(uuid, text) to authenticated;
grant execute on function public.get_user_streaks(uuid, text) to service_role;
