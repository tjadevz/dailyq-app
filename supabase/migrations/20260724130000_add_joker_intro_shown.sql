-- One-time flag: has this user seen the contextual joker intro card yet
-- (shown on the first missed-day-within-window tap, then never again).
alter table public.profiles
  add column if not exists joker_intro_shown boolean not null default false;
