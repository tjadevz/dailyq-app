-- get_user_streaks: count by answers.question_date (app uses question_date, not question_id).
-- Same timezone semantics; only the "has answer for day" check changes.

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
  'Returns visual_streak and real_streak: consecutive days with answers (by question_date) ending at yesterday in p_timezone.';
grant execute on function public.get_user_streaks(uuid, text) to authenticated;
grant execute on function public.get_user_streaks(uuid, text) to service_role;
