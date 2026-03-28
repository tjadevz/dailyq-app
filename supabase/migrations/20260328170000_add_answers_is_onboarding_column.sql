alter table public.answers
add column if not exists is_onboarding boolean not null default false;
