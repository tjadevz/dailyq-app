-- Postgres grants EXECUTE to PUBLIC by default; explicitly revoke it so only
-- service_role (the revenuecat-webhook Edge Function) can call grant_iap_jokers.
revoke execute on function public.grant_iap_jokers(uuid, text, text, text) from public;
revoke execute on function public.grant_iap_jokers(uuid, text, text, text) from anon;
revoke execute on function public.grant_iap_jokers(uuid, text, text, text) from authenticated;
