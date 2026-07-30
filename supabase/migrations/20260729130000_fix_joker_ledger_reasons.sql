-- Several joker_balance-mutating functions never set dailyq.joker_ledger_reason,
-- so log_joker_balance_change's generic fallback ('profile_update') swallowed
-- streak-milestone rewards, IAP purchases, and joker restores alike.
--
-- grant_milestone_jokers used to set 'streak_reward' (added in
-- 20260401133327_harden_milestone_grants.sql) but a same-day follow-up migration
-- (20260401133455_harden_milestone_grants.sql) replaced the function and dropped
-- that line — this restores it rather than inventing a new label, since 9
-- historical rows already use 'streak_reward'.

create or replace function public.grant_milestone_jokers(
  p_user_id uuid,
  p_milestone int,
  p_streak_at_grant int default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_already_or_higher boolean;
begin
  if p_milestone not in (7, 14, 30, 60, 100, 180, 365) then
    return;
  end if;

  select exists (
    select 1
    from public.user_milestone_grants
    where user_id = p_user_id
      and milestone >= p_milestone
  ) into v_already_or_higher;

  if v_already_or_higher then
    return;
  end if;

  perform set_config('dailyq.joker_ledger_reason', 'streak_reward', true);

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
    return false;
  end if;

  perform set_config('dailyq.joker_ledger_reason', 'iap_purchase', true);

  update public.profiles
  set joker_balance = coalesce(joker_balance, 0) + v_jokers
  where id = p_user_id;

  return true;
end;
$$;

create or replace function public.restore_joker()
returns void
language sql
security definer
set search_path = public
as $$
  select set_config('dailyq.joker_ledger_reason', 'joker_restored', true);
  update public.profiles
  set joker_balance = coalesce(joker_balance, 0) + 1
  where id = auth.uid();
$$;

-- Rename the generic fallback reason: in practice every legitimate app-driven
-- balance change now sets its own reason via dailyq.joker_ledger_reason, so
-- whatever still hits this default is a direct/manual balance edit (e.g. via
-- the Supabase dashboard SQL editor), not a "profile update".
create or replace function public.log_joker_balance_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old integer := coalesce(old.joker_balance, 0);
  v_new integer := coalesce(new.joker_balance, 0);
  v_delta integer := v_new - v_old;
  v_reason_override text := nullif(current_setting('dailyq.joker_ledger_reason', true), '');
begin
  if current_setting('dailyq.joker_ledger_skip', true) = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if v_new <> 0 then
      insert into public.joker_balance_ledger (
        user_id, delta, balance_before, balance_after, reason, metadata
      ) values (
        new.id,
        v_new,
        0,
        v_new,
        coalesce(v_reason_override, 'account_creation_grant'),
        jsonb_build_object(
          'trigger_op', tg_op,
          'calling_query', left(current_query(), 500)
        )
      );
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and v_new <> v_old then
    insert into public.joker_balance_ledger (
      user_id, delta, balance_before, balance_after, reason, metadata
    ) values (
      new.id,
      v_delta,
      v_old,
      v_new,
      coalesce(
        v_reason_override,
        case
          when v_delta < 0 then 'joker_used_for_answer'
          else 'admin_manual_adjustment'
        end
      ),
      jsonb_build_object(
        'trigger_op', tg_op,
        'calling_query', left(current_query(), 500)
      )
    );
  end if;

  return new;
end;
$$;

-- One-time backfill: reclassify existing 'profile_update' rows using the
-- calling_query captured in metadata to identify which function/path produced them.
update public.joker_balance_ledger
set reason = 'streak_reward'
where reason = 'profile_update'
  and metadata->>'calling_query' like '%grant_milestone_jokers%';

update public.joker_balance_ledger
set reason = 'iap_purchase'
where reason = 'profile_update'
  and metadata->>'calling_query' like '%grant_iap_jokers%';

update public.joker_balance_ledger
set reason = 'joker_restored'
where reason = 'profile_update'
  and metadata->>'calling_query' like '%restore_joker%';

update public.joker_balance_ledger
set reason = 'onboarding_reward'
where reason = 'profile_update'
  and metadata->>'calling_query' like '%onboarding_completed%';

-- Everything still left is a direct manual balance edit (dashboard/SQL editor).
update public.joker_balance_ledger
set reason = 'admin_manual_adjustment'
where reason = 'profile_update';
