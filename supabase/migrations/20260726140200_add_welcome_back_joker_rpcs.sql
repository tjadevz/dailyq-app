-- Welcome-back joker offer: RPCs to check eligibility and claim the reward.
-- Mirrors the grant_iap_jokers / handle_referral pattern: security definer,
-- idempotency guard, direct profiles.joker_balance update, manual
-- joker_balance_ledger insert with a precise reason (bypassing the generic
-- profile_update trigger via dailyq.joker_ledger_skip).

create or replace function public.get_welcome_back_offer(
  p_min_days_absent int default 3
)
returns table(days_absent int, absence_key date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last_answered date;
  v_resolved_for date;
  v_days int;
begin
  select p.last_answered_date, p.welcome_back_offer_resolved_for
  into v_last_answered, v_resolved_for
  from public.profiles p
  where p.id = auth.uid();

  if v_last_answered is null then
    return;
  end if;

  v_days := current_date - v_last_answered;

  if v_days < p_min_days_absent then
    return;
  end if;

  if v_resolved_for is not null and v_resolved_for = v_last_answered then
    return;
  end if;

  return query select v_days, v_last_answered;
end;
$$;

comment on function public.get_welcome_back_offer(int) is
  'Returns days_absent/absence_key if the current user has been absent >= p_min_days_absent and has not yet resolved (claimed or dismissed) the offer for this absence period. Empty result otherwise.';

grant execute on function public.get_welcome_back_offer(int) to authenticated;

create or replace function public.claim_welcome_back_joker(
  p_jokers int default 3,
  p_min_days_absent int default 3
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_last_answered date;
  v_resolved_for date;
  v_days int;
  v_balance_before int;
  v_balance_after int;
begin
  if v_user_id is null then
    return false;
  end if;

  select last_answered_date, welcome_back_offer_resolved_for, coalesce(joker_balance, 0)
  into v_last_answered, v_resolved_for, v_balance_before
  from public.profiles
  where id = v_user_id
  for update;

  if v_last_answered is null then
    return false;
  end if;

  v_days := current_date - v_last_answered;
  if v_days < p_min_days_absent then
    return false;
  end if;

  if v_resolved_for is not null and v_resolved_for = v_last_answered then
    -- Already claimed (or dismissed) for this absence period.
    return false;
  end if;

  perform set_config('dailyq.joker_ledger_skip', 'on', true);

  v_balance_after := v_balance_before + p_jokers;

  update public.profiles
  set joker_balance = v_balance_after,
      welcome_back_offer_resolved_for = v_last_answered
  where id = v_user_id;

  insert into public.joker_balance_ledger (
    user_id,
    delta,
    balance_before,
    balance_after,
    reason,
    metadata
  )
  values (
    v_user_id,
    p_jokers,
    v_balance_before,
    v_balance_after,
    'welcome_back_reward',
    jsonb_build_object('days_absent', v_days, 'last_answered_date', v_last_answered)
  );

  perform set_config('dailyq.joker_ledger_skip', 'off', true);

  return true;
end;
$$;

comment on function public.claim_welcome_back_joker(int, int) is
  'Grants p_jokers jokers once per absence period (>= p_min_days_absent days since last_answered_date). Idempotent via welcome_back_offer_resolved_for. Logs a joker_balance_ledger row with reason ''welcome_back_reward''.';

grant execute on function public.claim_welcome_back_joker(int, int) to authenticated;
