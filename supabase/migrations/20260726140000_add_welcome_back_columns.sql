-- Welcome-back joker offer: track when a user last answered and whether the
-- current absence period's in-app offer / push nudge has already been handled.

alter table public.profiles
  add column if not exists last_answered_date date;

alter table public.profiles
  add column if not exists welcome_back_offer_resolved_for date;

comment on column public.profiles.last_answered_date is
  'Most recent question_date the user submitted an answer for. Kept in sync by sync_current_streak() (trigger on answers insert).';

comment on column public.profiles.welcome_back_offer_resolved_for is
  'The last_answered_date value for which the welcome-back offer has already been shown and handled (claimed or dismissed). A new offer becomes available once last_answered_date advances past this.';

alter table public.push_subscriptions
  add column if not exists welcome_back_nudge_sent_for date;

comment on column public.push_subscriptions.welcome_back_nudge_sent_for is
  'Mirrors profiles.last_answered_date at the time the welcome-back push was last sent, so the nudge fires once per absence period rather than once per day.';
