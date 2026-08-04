-- URGENT hotfix: the 20260804160000 migration dropped
-- complete_onboarding_with_reward(boolean) entirely and replaced it with a
-- zero-arg version. The live App Store build (1.6.0) still calls the RPC
-- with a p_grant_joker argument -- that signature no longer existing makes
-- PostgREST return a function-not-found error, which breaks onboarding
-- completion for every new signup on 1.6.0 (both the "dismiss" and
-- "complete all questions" paths call this same RPC).
--
-- Restore a boolean-arg overload as a compatibility shim: it completes
-- onboarding exactly like the zero-arg version, but ignores p_grant_joker
-- entirely (no bonus joker -- that removal was intentional). This keeps
-- 1.6.0 clients working without an app update; a separate OTA to runtime
-- 1.6.0 removes the now-pointless "you earned a joker" reward modal so the
-- UI doesn't lie about a joker that's no longer granted.

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
begin
  return query select * from public.complete_onboarding_with_reward();
end;
$$;

comment on function public.complete_onboarding_with_reward(boolean) is
  'Compatibility overload for the live 1.6.0 client, which still passes p_grant_joker. The argument is ignored -- no joker reward, same as the zero-arg version. Remove once 1.6.0 is no longer in the field.';
