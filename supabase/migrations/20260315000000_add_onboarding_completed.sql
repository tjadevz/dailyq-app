-- onboarding_completed: when false, user is sent to onboarding-questions after auth.
-- When true (or after dismiss/complete), user goes to home. Used for calendar boundary (created_at - 7) when true.
alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

comment on column public.profiles.onboarding_completed is
  'If false, app redirects to onboarding-questions. When true, calendar boundary extends to created_at - 7 days.';
