-- get_user_streaks: use caller-provided timezone for "yesterday" (streak expires at user's local midnight).
-- p_timezone: IANA timezone (e.g. America/New_York). Default UTC for backward compatibility.

create or replace function public.get_user_streaks(p_user_id uuid, p_timezone text default 'UTC')
returns table (visual_streak bigint, real_streak bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_date date := ((now() at time zone coalesce(nullif(trim(p_timezone), ''), 'UTC'))::date - 1);
  streak_count bigint := 0;
  d date;
  has_ans boolean;
begin
  d := ref_date;
  loop
    select exists (
      select 1
      from public.answers a
      join public.questions q on q.id = a.question_id
      where a.user_id = p_user_id and q.day = d
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
  'Returns visual_streak and real_streak: consecutive days with answers ending at yesterday in p_timezone (today does not break the streak until after local midnight).';
grant execute on function public.get_user_streaks(uuid, text) to authenticated;
grant execute on function public.get_user_streaks(uuid, text) to service_role;
