-- Supabase schema for DailyQ MVP
-- Run this in your Supabase project's SQL editor.

-- QUESTIONS TABLE
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  -- Global calendar day key; you can choose date or text, here we use date.
  day date not null unique,
  inserted_at timestamptz not null default timezone('utc'::text, now())
);

-- ANSWERS TABLE
create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  answer_text text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint one_answer_per_user_per_day unique (user_id, question_id)
);

create index if not exists answers_user_id_created_at_idx
  on public.answers (user_id, created_at desc);

-- RLS POLICIES
alter table public.questions enable row level security;
alter table public.answers enable row level security;

-- QUESTIONS: everyone can read questions, nobody can write via client (manual management).
create policy "Public read questions"
  on public.questions for select
  using (true);

create policy "No client writes to questions"
  on public.questions for all
  using (false)
  with check (false);

-- ANSWERS: users can insert/select/update only their own answers.
create policy "Users can insert own answers"
  on public.answers for insert
  with check (auth.uid() = user_id);

create policy "Users can view own answers"
  on public.answers for select
  using (auth.uid() = user_id);

create policy "Users can update own answers"
  on public.answers for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Optionally restrict deletes; for MVP we can allow users to delete their own answers
create policy "Users can delete own answers"
  on public.answers for delete
  using (auth.uid() = user_id);

