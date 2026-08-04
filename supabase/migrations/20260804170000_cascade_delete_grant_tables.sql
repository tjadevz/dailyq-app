-- delete_user() does `DELETE FROM auth.users WHERE id = auth.uid()` and relies
-- entirely on FK cascades to clean up everything else. ad_reward_grants
-- (added today) and iap_purchase_grants (pre-existing) both reference
-- profiles(id) with no ON DELETE action, so any account that ever watched a
-- rewarded ad or bought jokers via IAP hits a foreign-key violation on
-- delete_user() and the deletion silently fails. Every other per-user table
-- (joker_balance_ledger, referrals, push_tickets, analytics_events, ...)
-- already cascades — bring these two in line.

alter table public.ad_reward_grants
  drop constraint ad_reward_grants_user_id_fkey,
  add constraint ad_reward_grants_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.iap_purchase_grants
  drop constraint iap_purchase_grants_user_id_fkey,
  add constraint iap_purchase_grants_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;
