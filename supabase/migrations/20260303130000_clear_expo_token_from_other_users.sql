-- Allow clearing expo_push_token from other users when the same token is reassigned (e.g. reinstall).
-- Prevents multiple users receiving the same notification when Expo returns the same token.
create or replace function public.clear_expo_push_token_from_other_users(p_token text, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token is null or p_token = '' then
    return;
  end if;
  update public.push_subscriptions
  set expo_push_token = null
  where expo_push_token = p_token
    and user_id != p_user_id;
end;
$$;

comment on function public.clear_expo_push_token_from_other_users(text, uuid) is
  'Clears expo_push_token from any row with the same token and a different user_id. Call before upserting the token for the current user to avoid duplicate token across users.';

grant execute on function public.clear_expo_push_token_from_other_users(text, uuid) to authenticated;
