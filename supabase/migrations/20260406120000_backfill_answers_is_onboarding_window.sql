-- Backfill answers.is_onboarding for completed-onboarding users: five calendar days
-- ending on signup local date (matches calendar onboarding window: signup - 4 .. signup).
-- Timezone: push_subscriptions.timezone when set, else Europe/Amsterdam.

alter table public.push_subscriptions
  add column if not exists timezone text;

do $$
declare
  v_updated int;
begin
  update public.answers a
  set is_onboarding = true
  from (
    select
      p.id as uid,
      (
        coalesce(p.created_at, (select u.created_at from auth.users u where u.id = p.id))
        at time zone coalesce(nullif(trim(ps.timezone), ''), 'Europe/Amsterdam')
      )::date as signup_local_date
    from public.profiles p
    left join public.push_subscriptions ps on ps.user_id = p.id
    where p.onboarding_completed = true
  ) u
  where a.user_id = u.uid
    and a.is_onboarding is false
    and a.question_date::date between u.signup_local_date - 4 and u.signup_local_date;

  get diagnostics v_updated = row_count;
  raise notice 'backfill answers is_onboarding (5-day window): updated % rows', v_updated;
end $$;
