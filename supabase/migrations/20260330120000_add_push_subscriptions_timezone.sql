-- Store device timezone (IANA name, e.g. "Europe/Amsterdam") for native push subscriptions.
alter table public.push_subscriptions
  add column if not exists timezone text;

comment on column public.push_subscriptions.timezone is
  'Device timezone (IANA) at the time the user set/updated notification preferences.';

