
ALTER TABLE push_subscriptions
ADD COLUMN IF NOT EXISTS last_evening_reminder_date date;
