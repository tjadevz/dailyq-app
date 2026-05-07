
ALTER TABLE push_subscriptions
ADD COLUMN IF NOT EXISTS last_notified_date date;
;
