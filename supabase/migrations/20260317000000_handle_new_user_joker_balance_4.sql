-- Ensure new users get joker_balance = 4 (not 2).
-- If a trigger/function inserts into profiles on auth signup and sets joker_balance to 2,
-- replace it so new profiles get 4. Table default is already 4; this fixes explicit inserts.

-- Drop trigger if it exists (so we can replace the function).
drop trigger if exists on_auth_user_created on auth.users;

-- Create or replace the function that runs on new user signup.
-- Inserts into public.profiles with joker_balance = 4; other columns use table defaults.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, joker_balance)
  values (new.id, 4);
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Inserts a row into public.profiles when a new auth user is created. Sets joker_balance to 4.';

-- Recreate the trigger.
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
