alter table public.profiles
  add column if not exists widget_installed boolean not null default false;

comment on column public.profiles.widget_installed is 'Synced from WidgetCenter on the client — true if the DailyQ home-screen widget is currently placed.';
