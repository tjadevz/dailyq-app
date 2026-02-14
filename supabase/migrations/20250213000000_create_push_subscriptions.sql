-- Push subscriptions for Web Push (one per user; upsert by user_id).
create table if not exists public.push_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- Users can only manage their own subscription.
create policy "Users manage own push subscription"
  on public.push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Optional: keep updated_at in sync on upsert (Supabase handles this if you use default).
create or replace function public.set_push_subscription_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger push_subscriptions_updated_at
  before insert or update on public.push_subscriptions
  for each row execute function public.set_push_subscription_updated_at();
