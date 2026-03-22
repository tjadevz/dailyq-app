-- Track whether streak milestone modals were already shown (10 / 30 / 100 days).
alter table public.profiles
  add column if not exists milestone_10_days_shown boolean not null default false,
  add column if not exists milestone_30_days_shown boolean not null default false,
  add column if not exists milestone_100_days_shown boolean not null default false;

comment on column public.profiles.milestone_10_days_shown is
  'True after the 10-day streak milestone UI was shown once.';
comment on column public.profiles.milestone_30_days_shown is
  'True after the 30-day streak milestone UI was shown once.';
comment on column public.profiles.milestone_100_days_shown is
  'True after the 100-day streak milestone UI was shown once.';
