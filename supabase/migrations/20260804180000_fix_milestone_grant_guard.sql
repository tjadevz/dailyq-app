-- grant_milestone_jokers' idempotency guard used "milestone >= p_milestone",
-- which blocks granting a LOWER milestone forever once any HIGHER one exists
-- for the user. Combined with a client bug that only ever granted the lowest
-- milestone crossed in a multi-milestone streak jump (e.g. via the missed-day
-- joker-recovery flow), this permanently dropped middle milestones (a user's
-- 14-day joker was skipped: grants existed for 7, 30, 60, 100 but not 14, and
-- this guard made it impossible to ever backfill). Exact-match idempotency is
-- what was actually intended ("once ever per milestone") and is already
-- enforced by the unique constraint on (user_id, milestone) anyway.

create or replace function public.grant_milestone_jokers(
  p_user_id uuid,
  p_milestone int,
  p_streak_at_grant int default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_already_granted boolean;
begin
  if p_milestone not in (7, 14, 30, 60, 100, 180, 365) then
    return;
  end if;

  -- Exact-match idempotency: block only re-granting this exact milestone,
  -- not any milestone below one already granted.
  select exists (
    select 1
    from public.user_milestone_grants
    where user_id = p_user_id
      and milestone = p_milestone
  ) into v_already_granted;

  if v_already_granted then
    return;
  end if;

  update public.profiles
  set joker_balance = coalesce(joker_balance, 0) + case p_milestone
    when 7 then 1
    when 14 then 1
    when 30 then 2
    when 60 then 2
    when 100 then 3
    when 180 then 4
    when 365 then 5
    else 0
  end
  where id = p_user_id;

  insert into public.user_milestone_grants (user_id, milestone, streak_at_grant)
  values (p_user_id, p_milestone, coalesce(p_streak_at_grant, 0))
  on conflict (user_id, milestone) do nothing;
end;
$$;

comment on function public.grant_milestone_jokers(uuid, int, int) is
  'Awards jokers for streak milestones once each (exact-match idempotency on (user_id, milestone)) — a lower milestone can still be backfilled after a higher one was already granted.';
