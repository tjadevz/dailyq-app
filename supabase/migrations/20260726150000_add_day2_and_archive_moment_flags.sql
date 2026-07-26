-- One-time flags for the day-2 archive push nudge and the day-4 in-app
-- "archive moment" screen (see send-day2-notification and ArchiveMomentModal).
alter table public.profiles
  add column if not exists day2_notification_sent boolean not null default false,
  add column if not exists archive_moment_day4_shown boolean not null default false;
comment on column public.profiles.day2_notification_sent is
  'True once the one-time day-2 archive nudge push has been sent.';
comment on column public.profiles.archive_moment_day4_shown is
  'True once the one-time day-4 "answers so far" archive moment was shown.';
