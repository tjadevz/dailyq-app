-- Ledger for joker balance mutations (awards/deductions).
-- Logs every change to profiles.joker_balance so grants are auditable.

create table if not exists public.joker_balance_ledger (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta integer not null,
  balance_before integer not null,
  balance_after integer not null,
  reason text not null default 'profile_update',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.joker_balance_ledger is
  'Append-only audit trail for joker balance changes.';

comment on column public.joker_balance_ledger.delta is
  'Change amount: positive = awarded, negative = spent.';

create index if not exists joker_balance_ledger_user_created_idx
  on public.joker_balance_ledger (user_id, created_at desc);

alter table public.joker_balance_ledger enable row level security;

drop policy if exists "Users can view own joker balance ledger" on public.joker_balance_ledger;
create policy "Users can view own joker balance ledger"
  on public.joker_balance_ledger for select
  using (auth.uid() = user_id);

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

comment on function public.log_joker_balance_change() is
  'Trigger function that logs every profiles.joker_balance mutation.';

drop trigger if exists profiles_joker_balance_ledger_trg on public.profiles;
create trigger profiles_joker_balance_ledger_trg
after insert or update of joker_balance on public.profiles
for each row execute function public.log_joker_balance_change();

grant select on public.joker_balance_ledger to authenticated;
grant select on public.joker_balance_ledger to service_role;
