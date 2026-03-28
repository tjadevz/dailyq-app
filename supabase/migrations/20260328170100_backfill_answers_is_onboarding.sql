do $$
declare
  v_updated int;
begin
  update public.answers a
  set is_onboarding = true
  where a.created_at::date = (
    select p.created_at::date from public.profiles p where p.id = a.user_id
  );

  get diagnostics v_updated = row_count;
  raise notice 'backfill is_onboarding: updated % rows', v_updated;
end $$;
