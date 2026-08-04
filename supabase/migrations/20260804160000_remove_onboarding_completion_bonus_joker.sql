-- Remove the +1 bonus joker granted on onboarding completion. Joker economy
-- is being tightened now that IAP and ad-for-joker are both live: users start
-- with only the 2 base signup jokers (handle_new_user trigger) plus the
-- existing streak-milestone jokers (grant_milestone_jokers). The
-- onboarding_joker_granted column is left in place (unused, harmless) rather
-- than dropped, since nothing else references it.

drop function if exists public.complete_onboarding_with_reward(boolean);

create or replace function public.complete_onboarding_with_reward()
returns table (
  onboarding_completed boolean,
  onboarding_completed_at timestamptz,
  joker_balance integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id      uuid        := auth.uid();
  v_completed_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select p.onboarding_completed_at
  into v_completed_at
  from public.profiles p
  where p.id = v_user_id;

  if not found then
    raise exception 'Profile not found for user %', v_user_id;
  end if;

  update public.profiles
  set
    onboarding_completed    = true,
    onboarding_completed_at = coalesce(v_completed_at, timezone('utc'::text, now()))
  where id = v_user_id;

  return query
  select
    p.onboarding_completed,
    p.onboarding_completed_at,
    p.joker_balance
  from public.profiles p
  where p.id = v_user_id;
end;
$$;
comment on function public.complete_onboarding_with_reward() is
  'Marks onboarding as completed for auth.uid(). No joker reward — onboarding grants only the 2 base signup jokers.';
