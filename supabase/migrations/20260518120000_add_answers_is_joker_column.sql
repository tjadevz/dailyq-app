alter table public.answers
add column if not exists is_joker boolean not null default false;

comment on column public.answers.is_joker is
  'True when the user spent a joker to answer this question date.';
