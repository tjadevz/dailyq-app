
ALTER TABLE push_subscriptions
ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Amsterdam';
;
