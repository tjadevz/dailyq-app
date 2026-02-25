-- Add Expo push token for native app; allow rows with only expo_push_token (endpoint/p256dh/auth nullable).
alter table public.push_subscriptions
  add column if not exists expo_push_token text;

alter table public.push_subscriptions
  alter column endpoint drop not null,
  alter column p256dh drop not null,
  alter column auth drop not null;

comment on column public.push_subscriptions.expo_push_token is 'Expo push token from native app (e.g. ExponentPushToken[...]).';
