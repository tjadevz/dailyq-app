-- Decouple joker reward idempotency from onboarding_completed flag.
-- Previously the joker was only granted when onboarding_completed was still false,
-- meaning a call at "BEGIN" click (which sets onboarding_completed=true without a joker)
-- would permanently block the joker grant at the end of the question flow.
-- Now we track joker grant separately via onboarding_joker_granted.

create or replace function public.complete_onboarding_with_reward(p_grant_joker boolean default false)
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
  v_user_id            uuid        := auth.uid();
  v_completed_at       timestamptz;
  v_already_completed  boolean;
  v_current_balance    integer;
  v_joker_granted      boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Read current profile values into unambiguous variables before the UPDATE.
  select
    p.onboarding_completed_at,
    p.onboarding_completed,
    p.joker_balance,
    p.onboarding_joker_granted
  into
    v_completed_at,
    v_already_completed,
    v_current_balance,
    v_joker_granted
  from public.profiles p
  where p.id = v_user_id;

  if not found then
    raise exception 'Profile not found for user %', v_user_id;
  end if;

  if p_grant_joker and not coalesce(v_joker_granted, false) then
    perform set_config('dailyq.joker_ledger_reason', 'onboarding_reward', true);
  end if;

  update public.profiles
  set
    onboarding_completed      = true,
    onboarding_completed_at   = coalesce(v_completed_at, timezone('utc'::text, now())),
    joker_balance             = case
      when p_grant_joker and not coalesce(v_joker_granted, false)
        then coalesce(v_current_balance, 0) + 1
      else v_current_balance
    end,
    onboarding_joker_granted  = case
      when p_grant_joker and not coalesce(v_joker_granted, false) then true
      else coalesce(v_joker_granted, false)
    end
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

comment on function public.complete_onboarding_with_reward(boolean) is
  'Marks onboarding as completed for auth.uid(); optional +1 joker is idempotent via onboarding_joker_granted (independent of onboarding_completed). Safe to call at BEGIN click (no joker) and again at flow completion (with joker).';
