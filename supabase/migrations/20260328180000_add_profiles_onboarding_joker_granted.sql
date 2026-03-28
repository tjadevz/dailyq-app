alter table public.profiles
  add column if not exists onboarding_joker_granted boolean not null default false;
