-- Remove the single-parameter overload so only get_user_streaks(uuid, text) exists.
-- Fixes PostgreSQL error 42725: "function public.get_user_streaks(uuid) is not unique".

drop function if exists public.get_user_streaks(uuid);
