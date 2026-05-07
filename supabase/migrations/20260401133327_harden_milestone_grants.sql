
-- Stap 1: verwijder duplicate grants, behoud de oudste per (user_id, milestone)
DELETE FROM public.user_milestone_grants
WHERE id NOT IN (
  SELECT MIN(id)
  FROM public.user_milestone_grants
  GROUP BY user_id, milestone
);

-- Stap 2: backfill — voor elke user die een hogere milestone heeft, voeg lagere toe
-- Geordende milestone lijst: 7, 14, 30, 60, 100, 180, 365
INSERT INTO public.user_milestone_grants (user_id, milestone, streak_at_grant)
SELECT DISTINCT g.user_id, m.milestone, 0
FROM public.user_milestone_grants g
JOIN (VALUES (7), (14), (30), (60), (100), (180), (365)) AS m(milestone)
  ON m.milestone < g.milestone
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_milestone_grants g2
  WHERE g2.user_id = g.user_id AND g2.milestone = m.milestone
)
ON CONFLICT DO NOTHING;

-- Stap 3: voeg UNIQUE constraint toe
ALTER TABLE public.user_milestone_grants
ADD CONSTRAINT unique_user_milestone UNIQUE (user_id, milestone);

-- Stap 4: harden grant_milestone_jokers — blokkeer als er al een >= milestone bestaat
CREATE OR REPLACE FUNCTION public.grant_milestone_jokers(p_user_id uuid, p_milestone integer, p_streak_at_grant integer DEFAULT NULL::integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_already boolean;
begin
  if p_milestone not in (7, 14, 30, 60, 100, 180, 365) then
    return;
  end if;

  -- Geblokkeerd als er al een grant bestaat met milestone >= p_milestone
  select exists (
    select 1 from public.user_milestone_grants
    where user_id = p_user_id and milestone >= p_milestone
  ) into v_already;

  if v_already then
    return;
  end if;

  perform set_config('dailyq.joker_ledger_reason', 'streak_reward', true);

  update public.profiles
  set joker_balance = coalesce(joker_balance, 0) + case p_milestone
    when 7 then 1
    when 14 then 1
    when 30 then 2
    when 60 then 2
    when 100 then 3
    when 180 then 4
    when 365 then 5
    else 0
  end
  where id = p_user_id;

  insert into public.user_milestone_grants (user_id, milestone, streak_at_grant)
  values (p_user_id, p_milestone, coalesce(p_streak_at_grant, 0));
end;
$function$;
;
