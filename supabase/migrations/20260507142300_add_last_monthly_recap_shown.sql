alter table profiles
add column if not exists last_monthly_recap_shown date null default null;
