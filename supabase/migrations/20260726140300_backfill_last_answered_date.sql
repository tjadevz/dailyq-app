-- One-time backfill: sync_current_streak() only sets last_answered_date on
-- new answer inserts going forward, so existing users (including the
-- currently-absent users this feature targets) would otherwise stay null
-- forever until their next answer. Populate from existing answers history.
update public.profiles p
set last_answered_date = a.max_question_date
from (
  select user_id, max(question_date) as max_question_date
  from public.answers
  group by user_id
) a
where a.user_id = p.id
  and (p.last_answered_date is null or p.last_answered_date < a.max_question_date);
