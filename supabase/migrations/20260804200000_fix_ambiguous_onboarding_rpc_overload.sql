-- The previous compat overload (20260804190000) delegated to the zero-arg
-- complete_onboarding_with_reward() via `select * from
-- complete_onboarding_with_reward()` -- that call is AMBIGUOUS between the
-- zero-arg function and the boolean-arg function's own default value, so
-- Postgres raised "function ... is not unique" and the RPC kept failing for
-- every 1.6.0 client exactly as before, just with a different error. Inline
-- the logic directly instead of delegating, so there's no ambiguous
-- self-call.

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

comment on function public.complete_onboarding_with_reward(boolean) is
  'Compatibility overload for the live 1.6.0 client, which still passes p_grant_joker. The argument is ignored -- no joker reward, same as the zero-arg version. Remove once 1.6.0 is no longer in the field.';
