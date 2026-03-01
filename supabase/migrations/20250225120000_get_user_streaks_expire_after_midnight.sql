-- get_user_streaks: streak only expires when the day has ended (after midnight).
-- So we count consecutive days with answers ending at YESTERDAY (last closed day).
-- If the user has not answered today yet, their streak is still the count up to yesterday.

create or replace function public.get_user_streaks(p_user_id uuid)
returns table (visual_streak bigint, real_streak bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_date date := current_date - 1;  -- yesterday = last day that has "expired"
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

comment on function public.get_user_streaks(uuid) is
  'Returns visual_streak and real_streak: consecutive days with answers ending at yesterday (today does not break the streak until after midnight).';

grant execute on function public.get_user_streaks(uuid) to authenticated;
grant execute on function public.get_user_streaks(uuid) to service_role;
