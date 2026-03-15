-- New users get 4 jokers by default (was 2).
ALTER TABLE public.profiles
  ALTER COLUMN joker_balance SET DEFAULT 4;
