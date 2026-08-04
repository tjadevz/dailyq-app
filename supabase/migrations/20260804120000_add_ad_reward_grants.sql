-- AdMob rewarded-ad joker grants, verified server-side via AdMob's Server-Side
-- Verification (SSV) callback. Mirrors iap_purchase_grants/grant_iap_jokers:
-- idempotency comes from a unique constraint on the AdMob-issued transaction_id,
-- and the grant is only ever called by the admob-ssv Edge Function using the
-- service role key. The joker count is fixed at 1 here (not trusted from the
-- SSV reward_amount param) since that's the only reward this app's ad unit is
-- configured to pay out; reward_amount is stored purely for audit purposes.

create table if not exists public.ad_reward_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  ad_network text,
  ad_unit text,
  reward_item text,
  reward_amount int,
  admob_transaction_id text not null unique,
  jokers_granted int not null,
  created_at timestamptz not null default now()
);

alter table public.ad_reward_grants enable row level security;

create policy "Users can view their own ad reward grants"
  on public.ad_reward_grants
  for select
  using (auth.uid() = user_id);

create or replace function public.grant_ad_reward_jokers(
  p_user_id uuid,
  p_transaction_id text,
  p_ad_network text default null,
  p_ad_unit text default null,
  p_reward_item text default null,
  p_reward_amount int default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jokers constant int := 1;
  v_inserted_id uuid;
begin
  insert into public.ad_reward_grants (
    user_id, ad_network, ad_unit, reward_item, reward_amount, admob_transaction_id, jokers_granted
  )
  values (
    p_user_id, p_ad_network, p_ad_unit, p_reward_item, p_reward_amount, p_transaction_id, v_jokers
  )
  on conflict (admob_transaction_id) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    -- Duplicate/replayed SSV callback for a transaction already granted.
    return false;
  end if;

  perform set_config('dailyq.joker_ledger_reason', 'ad_reward', true);

  update public.profiles
  set joker_balance = coalesce(joker_balance, 0) + v_jokers
  where id = p_user_id;

  return true;
end;
$$;

comment on function public.grant_ad_reward_jokers(uuid, text, text, text, text, int) is
  'Grants 1 joker for a verified AdMob rewarded-ad view, once per unique AdMob transaction id. Callable only by service_role (the admob-ssv Edge Function) — never by authenticated clients.';

-- Postgres grants EXECUTE to PUBLIC by default; explicitly restrict to service_role
-- only, since this function trusts p_user_id as given (same pattern as grant_iap_jokers).
revoke execute on function public.grant_ad_reward_jokers(uuid, text, text, text, text, int) from public;
revoke execute on function public.grant_ad_reward_jokers(uuid, text, text, text, text, int) from anon;
revoke execute on function public.grant_ad_reward_jokers(uuid, text, text, text, text, int) from authenticated;
grant execute on function public.grant_ad_reward_jokers(uuid, text, text, text, text, int) to service_role;
