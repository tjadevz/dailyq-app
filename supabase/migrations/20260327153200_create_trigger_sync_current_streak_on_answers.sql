drop trigger if exists trigger_sync_current_streak on public.answers;

create trigger trigger_sync_current_streak
after insert on public.answers
for each row
execute function public.sync_current_streak();
