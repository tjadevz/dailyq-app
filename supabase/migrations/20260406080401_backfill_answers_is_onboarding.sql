
UPDATE answers a
SET is_onboarding = true
FROM profiles p
WHERE a.user_id = p.id
  AND a.is_onboarding = false
  AND a.created_at <= p.created_at + interval '30 minutes';
;
