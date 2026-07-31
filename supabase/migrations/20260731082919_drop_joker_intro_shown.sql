-- The one-time joker intro card was removed; its explanatory text now always
-- shows inside JokerOfferModal instead. Drop the now-unused flag.
alter table public.profiles
  drop column if exists joker_intro_shown;
