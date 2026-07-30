-- The App Store Connect product id for the 10-pack was created as "Jokers_10"
-- (capital J), unlike "jokers_3"/"jokers_5". grant_iap_jokers did a case-sensitive
-- match on the lowercase form, so a real purchase of the 10-pack would have been
-- recorded (unique transaction id) but granted 0 jokers.

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
    when 'Jokers_10' then 10
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
