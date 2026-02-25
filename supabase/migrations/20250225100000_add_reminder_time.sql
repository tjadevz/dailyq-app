-- Store preferred reminder time (morning / afternoon / evening) for native app.
-- Backend can use this to schedule push at the right time per user.
alter table public.push_subscriptions
  add column if not exists reminder_time text;

comment on column public.push_subscriptions.reminder_time is 'Preferred slot: morning, afternoon, or evening (native app).';
