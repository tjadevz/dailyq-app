
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
  v_already_or_higher boolean;
begin
  if p_milestone not in (7, 14, 30, 60, 100, 180, 365) then
    return;
  end if;

  -- Hard guard: if same or higher milestone already exists, do not award again.
  select exists (
    select 1
    from public.user_milestone_grants
    where user_id = p_user_id
      and milestone >= p_milestone
  ) into v_already_or_higher;

  if v_already_or_higher then
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
  values (p_user_id, p_milestone, coalesce(p_streak_at_grant, 0));
end;
$$;

comment on function public.grant_milestone_jokers(uuid, int, int) is
  'Awards jokers for streak milestones once. If same or higher milestone already exists for user, no reward is granted.';

grant execute on function public.grant_milestone_jokers(uuid, int, int) to authenticated;
grant execute on function public.grant_milestone_jokers(uuid, int, int) to service_role;

-- Backfill legacy inconsistencies:
-- if highest milestone is M, ensure all lower milestones <= M exist.
with user_highest as (
  select user_id, max(milestone) as highest_milestone
  from public.user_milestone_grants
  group by user_id
),
missing_lower as (
  select
    uh.user_id,
    m as milestone,
    uh.highest_milestone
  from user_highest uh
  cross join unnest(array[7, 14, 30, 60, 100, 180, 365]) as m
  where m <= uh.highest_milestone
)
insert into public.user_milestone_grants (user_id, milestone, streak_at_grant)
select
  ml.user_id,
  ml.milestone,
  ml.highest_milestone
from missing_lower ml
on conflict (user_id, milestone) do nothing;
;
