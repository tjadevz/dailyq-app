do $$
declare
  r record;
begin
  for r in
    select is_onboarding, count(*)::bigint as cnt
    from public.answers
    group by is_onboarding
    order by is_onboarding
  loop
    raise notice 'verification is_onboarding=% count=%', r.is_onboarding, r.cnt;
  end loop;
end $$;
