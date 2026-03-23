-- Refer A Friend system

-- Required for gen_random_uuid()
create extension if not exists pgcrypto;

-- 1) Add referral_code to profiles
alter table public.profiles
  add column if not exists referral_code text unique;

-- 2) Generate a unique 8-character referral code (lowercase letters + digits)
create or replace function public.generate_referral_code()
returns text
language plpgsql
as $$
declare
  chars text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result text := '';
  i int;
  code_exists boolean;
begin
  loop
    result := '';
    for i in 1..8 loop
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;

    select exists(
      select 1 from public.profiles where referral_code = result
    )
    into code_exists;

    exit when not code_exists;
  end loop;

  return result;
end;
$$;

-- 3) Backfill referral_code for existing users
update public.profiles
set referral_code = public.generate_referral_code()
where referral_code is null;

-- 4) Trigger: automatically set referral_code for new profiles
create or replace function public.set_referral_code()
returns trigger
language plpgsql
as $$
begin
  if new.referral_code is null then
    new.referral_code := public.generate_referral_code();
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_set_referral_code on public.profiles;
create trigger trigger_set_referral_code
  before insert on public.profiles
  for each row execute function public.set_referral_code();

-- 5) Referrals table
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz default now()
);

create index if not exists referrals_referrer_id_idx
  on public.referrals (referrer_id);

-- We already have a trigger that writes to public.joker_balance_ledger when
-- public.profiles.joker_balance changes. For handle_referral we want to write
-- the ledger rows ourselves with a specific reason, so we allow the trigger
-- to be skipped for the duration of that function call (transaction-local).
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
begin
  if current_setting('dailyq.joker_ledger_skip', true) = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if v_new <> 0 then
      insert into public.joker_balance_ledger (
        user_id,
        delta,
        balance_before,
        balance_after,
        reason,
        metadata
      )
      values (
        new.id,
        v_new,
        0,
        v_new,
        'profile_insert',
        jsonb_build_object('trigger_op', tg_op)
      );
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and v_new <> v_old then
    insert into public.joker_balance_ledger (
      user_id,
      delta,
      balance_before,
      balance_after,
      reason,
      metadata
    )
    values (
      new.id,
      v_delta,
      v_old,
      v_new,
      'profile_update',
      jsonb_build_object('trigger_op', tg_op)
    );
  end if;

  return new;
end;
$$;

-- 6) RPC: handle_referral
create or replace function public.handle_referral(
  p_referral_code text,
  p_new_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;

  v_referrer_balance_before integer;
  v_referrer_balance_after integer;
  v_referred_balance_before integer;
  v_referred_balance_after integer;
begin
  if p_referral_code is null or btrim(p_referral_code) = '' then
    return false;
  end if;

  -- Zoek referrer op basis van code
  select id into v_referrer_id
  from public.profiles
  where referral_code = p_referral_code;

  if v_referrer_id is null then
    return false;
  end if;

  -- Geen self-referral
  if v_referrer_id = p_new_user_id then
    return false;
  end if;

  -- Controleer of nieuwe gebruiker al gereferreerd is
  if exists (
    select 1 from public.referrals where referred_id = p_new_user_id
  ) then
    return false;
  end if;

  -- Skip automatic ledger writes while we do the manual inserts below.
  perform set_config('dailyq.joker_ledger_skip', 'on', true);

  -- Lock both profile rows for consistent balance updates.
  if v_referrer_id < p_new_user_id then
    select coalesce(joker_balance, 0) into v_referrer_balance_before
    from public.profiles
    where id = v_referrer_id
    for update;

    if v_referrer_balance_before is null then
      perform set_config('dailyq.joker_ledger_skip', 'off', true);
      return false;
    end if;

    select coalesce(joker_balance, 0) into v_referred_balance_before
    from public.profiles
    where id = p_new_user_id
    for update;

    if v_referred_balance_before is null then
      perform set_config('dailyq.joker_ledger_skip', 'off', true);
      return false;
    end if;
  else
    select coalesce(joker_balance, 0) into v_referred_balance_before
    from public.profiles
    where id = p_new_user_id
    for update;

    if v_referred_balance_before is null then
      perform set_config('dailyq.joker_ledger_skip', 'off', true);
      return false;
    end if;

    select coalesce(joker_balance, 0) into v_referrer_balance_before
    from public.profiles
    where id = v_referrer_id
    for update;

    if v_referrer_balance_before is null then
      perform set_config('dailyq.joker_ledger_skip', 'off', true);
      return false;
    end if;
  end if;

  -- Insert referral record
  begin
    insert into public.referrals (referrer_id, referred_id)
    values (v_referrer_id, p_new_user_id);
  exception
    when unique_violation then
      perform set_config('dailyq.joker_ledger_skip', 'off', true);
      return false;
  end;

  -- +1 joker aan referrer
  v_referrer_balance_after := v_referrer_balance_before + 1;
  update public.profiles
  set joker_balance = v_referrer_balance_after
  where id = v_referrer_id;

  insert into public.joker_balance_ledger (
    user_id,
    delta,
    balance_before,
    balance_after,
    reason,
    metadata
  )
  values (
    v_referrer_id,
    1,
    v_referrer_balance_before,
    v_referrer_balance_after,
    'referral_given',
    jsonb_build_object('referred_id', p_new_user_id, 'referral_code', p_referral_code)
  );

  -- +1 joker aan nieuwe gebruiker
  v_referred_balance_after := v_referred_balance_before + 1;
  update public.profiles
  set joker_balance = v_referred_balance_after
  where id = p_new_user_id;

  insert into public.joker_balance_ledger (
    user_id,
    delta,
    balance_before,
    balance_after,
    reason,
    metadata
  )
  values (
    p_new_user_id,
    1,
    v_referred_balance_before,
    v_referred_balance_after,
    'referral_received',
    jsonb_build_object('referrer_id', v_referrer_id, 'referral_code', p_referral_code)
  );

  perform set_config('dailyq.joker_ledger_skip', 'off', true);
  return true;
end;
$$;

grant execute on function public.handle_referral(text, uuid) to authenticated;
grant execute on function public.handle_referral(text, uuid) to service_role;

