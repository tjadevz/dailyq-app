-- Consumable joker-pack purchases (RevenueCat), granted idempotently via the
-- revenuecat-webhook Edge Function. Never called directly by the client.

create table if not exists public.iap_purchase_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  product_id text not null,
  revenuecat_transaction_id text not null unique,
  environment text,
  jokers_granted int not null,
  created_at timestamptz not null default now()
);

alter table public.iap_purchase_grants enable row level security;

create policy "Users can view their own iap purchase grants"
  on public.iap_purchase_grants
  for select
  using (auth.uid() = user_id);

create or replace function public.grant_iap_jokers(
  p_user_id uuid,
  p_transaction_id text,
  p_product_id text,
  p_environment text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jokers int;
  v_inserted_id uuid;
begin
  v_jokers := case p_product_id
    when 'jokers_3' then 3
    when 'jokers_5' then 5
    when 'jokers_10' then 10
    else 0
  end;

  if v_jokers = 0 then
    return false;
  end if;

  insert into public.iap_purchase_grants (user_id, product_id, revenuecat_transaction_id, environment, jokers_granted)
  values (p_user_id, p_product_id, p_transaction_id, p_environment, v_jokers)
  on conflict (revenuecat_transaction_id) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    -- Duplicate/replayed webhook event for a transaction already granted.
    return false;
  end if;

  update public.profiles
  set joker_balance = coalesce(joker_balance, 0) + v_jokers
  where id = p_user_id;

  return true;
end;
$$;

comment on function public.grant_iap_jokers(uuid, text, text, text) is
  'Grants jokers for a consumable RevenueCat purchase, once per unique transaction id. Callable only by service_role (the revenuecat-webhook Edge Function) — never by authenticated clients.';

-- Deliberately NOT granted to `authenticated`: only the webhook Edge Function
-- (using the service role key) may call this, since it trusts p_user_id as-is.
grant execute on function public.grant_iap_jokers(uuid, text, text, text) to service_role;
