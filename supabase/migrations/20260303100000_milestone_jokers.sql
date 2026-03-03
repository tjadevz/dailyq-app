-- Track which streak milestones have already granted jokers (one grant per user per milestone).
create table if not exists public.user_milestone_grants (
  user_id uuid not null references auth.users(id) on delete cascade,
  milestone int not null,
  granted_at timestamptz not null default timezone('utc'::text, now()),
  primary key (user_id, milestone),
  constraint milestone_allowed check (milestone in (7, 30, 60, 100, 180, 365))
);

alter table public.user_milestone_grants enable row level security;

create policy "Users can view own milestone grants"
  on public.user_milestone_grants for select
  using (auth.uid() = user_id);

-- No insert/update/delete from client; only grant_milestone_jokers (security definer) writes.

comment on table public.user_milestone_grants is
  'Records which streak milestones have already awarded jokers to the user.';

-- Grant jokers for a given streak milestone (7 → 1, 30 → 2, 60 → 2, 100 → 3, 180 → 4, 365 → 5).
-- Idempotent: if this milestone was already granted, no-op and return success.
-- Requires: profiles.joker_balance and profiles.id exist.
create or replace function public.grant_milestone_jokers(p_milestone int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jokers int;
  v_already boolean;
begin
  if p_milestone not in (7, 30, 60, 100, 180, 365) then
    return;
  end if;

  select exists (
    select 1 from public.user_milestone_grants
    where user_id = auth.uid() and milestone = p_milestone
  ) into v_already;
  if v_already then
    return;
  end if;

  v_jokers := case p_milestone
    when 7 then 1
    when 30 then 2
    when 60 then 2
    when 100 then 3
    when 180 then 4
    when 365 then 5
    else 0
  end;

  if v_jokers <= 0 then
    return;
  end if;

  update public.profiles
  set joker_balance = coalesce(joker_balance, 0) + v_jokers
  where id = auth.uid();

  insert into public.user_milestone_grants (user_id, milestone)
  values (auth.uid(), p_milestone);
end;
$$;

comment on function public.grant_milestone_jokers(int) is
  'Awards jokers for crossing a streak milestone (7,30,60,100,180,365). Idempotent per milestone.';

grant execute on function public.grant_milestone_jokers(int) to authenticated;
grant execute on function public.grant_milestone_jokers(int) to service_role;
