-- Add 14-day streak milestone (1 joker). Allow 14 in user_milestone_grants and in grant_milestone_jokers.
alter table public.user_milestone_grants
  drop constraint if exists milestone_allowed;

alter table public.user_milestone_grants
  add constraint milestone_allowed check (milestone in (7, 14, 30, 60, 100, 180, 365));

create or replace function public.grant_milestone_jokers(p_user_id uuid, p_milestone int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_already boolean;
begin
  if p_milestone not in (7, 14, 30, 60, 100, 180, 365) then
    return;
  end if;

  select exists (
    select 1 from public.user_milestone_grants
    where user_id = p_user_id and milestone = p_milestone
  ) into v_already;
  if v_already then
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

  insert into public.user_milestone_grants (user_id, milestone)
  values (p_user_id, p_milestone);
end;
$$;

comment on function public.grant_milestone_jokers(uuid, int) is
  'Awards jokers for crossing a streak milestone (7,14,30,60,100,180,365). Idempotent per milestone. p_user_id: user to grant to.';
