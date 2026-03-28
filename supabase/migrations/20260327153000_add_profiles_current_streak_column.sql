alter table public.profiles
add column if not exists current_streak integer not null default 0;
