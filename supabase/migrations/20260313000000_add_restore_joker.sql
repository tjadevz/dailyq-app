-- Compensating function: restore one joker to the caller's balance.
-- Used when use_joker succeeds but the follow-up answers.insert fails,
-- so the deducted joker is returned atomically server-side.
create or replace function public.restore_joker()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set joker_balance = coalesce(joker_balance, 0) + 1
  where id = auth.uid();
$$;
comment on function public.restore_joker() is
  'Restores one joker to the calling user. Used to compensate a use_joker that was not followed by a successful answer insert.';
grant execute on function public.restore_joker() to authenticated;
