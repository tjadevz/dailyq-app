-- Runs 5 minutes ahead of the daily/evening reminder ticks (:00/:30) so that,
-- when it sends, its push_subscriptions.last_notified_date write always lands
-- before send-daily-notifications' own tick for the same slot.
SELECT cron.schedule(
  'day2-notification',
  '25,55 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://sfxarvxtouzrhkuwcofu.supabase.co/functions/v1/send-day2-notification',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
