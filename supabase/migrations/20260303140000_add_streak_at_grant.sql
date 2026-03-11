-- Add streak_at_grant to user_milestone_grants for cycle-aware granting (idempotent).
alter table public.user_milestone_grants
  add column if not exists streak_at_grant integer not null default 0;

comment on column public.user_milestone_grants.streak_at_grant is
  'Streak value at time of grant; used to determine if milestone was already granted in current cycle.';

-- grant_milestone_jokers: CREATE OR REPLACE is idempotent (safe if already applied via SQL Editor).
create or replace function public.grant_milestone_jokers(p_user_id uuid, p_milestone int, p_streak_at_grant int default null)
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

  insert into public.user_milestone_grants (user_id, milestone, streak_at_grant)
  values (p_user_id, p_milestone, coalesce(p_streak_at_grant, 0));
end;
$$;

comment on function public.grant_milestone_jokers(uuid, int, int) is
  'Awards jokers for crossing a streak milestone. Idempotent per milestone. p_streak_at_grant: streak at grant time (for cycle tracking).';

grant execute on function public.grant_milestone_jokers(uuid, int, int) to authenticated;
grant execute on function public.grant_milestone_jokers(uuid, int, int) to service_role;
