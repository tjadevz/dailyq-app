-- New users get 2 jokers by default (was 4).
alter table public.profiles
  alter column joker_balance set default 2;
-- Drop trigger so we can replace the function.
drop trigger if exists on_auth_user_created on auth.users;
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, joker_balance)
  values (new.id, 2);
  return new;
end;
$$;
comment on function public.handle_new_user() is
  'Inserts a row into public.profiles when a new auth user is created. Sets joker_balance to 2.';
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
