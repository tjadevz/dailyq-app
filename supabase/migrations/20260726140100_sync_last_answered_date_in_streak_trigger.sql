-- Extend the existing answers-insert trigger to also maintain
-- profiles.last_answered_date, instead of adding a second trigger.
create or replace function public.sync_current_streak()
returns trigger as $$
declare
  v_visual_streak integer;
begin
  select visual_streak::integer into v_visual_streak
  from public.get_user_streaks(new.user_id);

  update public.profiles
  set current_streak = v_visual_streak,
      last_answered_date = greatest(coalesce(last_answered_date, new.question_date), new.question_date)
  where id = new.user_id;

  return new;
end;
$$ language plpgsql security definer;
