-- The "widget now available" post-answer nudge (WidgetAnnouncementModal) was only
-- tracked client-side in AsyncStorage (see setWidgetAnnouncementDismissed in
-- widgetAnnouncement.ts), unlike its sibling "shown once" flags
-- (joker_intro_shown, archive_moment_day4_shown, milestone_10_days_shown), which
-- all live on profiles. A device-local reinstall/reset between onboarding and the
-- user's first answer wipes that flag, so a user who already saw the dedicated
-- onboarding-widget step sees the same announcement again after answering.
alter table public.profiles
  add column if not exists widget_announcement_dismissed boolean not null default false;
