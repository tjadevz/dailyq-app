
-- Remove old fixed-time cron jobs
SELECT cron.unschedule('daily-notifications-morning');
SELECT cron.unschedule('daily-notifications-afternoon');
SELECT cron.unschedule('daily-notifications-evening');

-- Single job every 30 minutes — Edge Function now decides who gets notified
SELECT cron.schedule(
  'daily-notifications',
  '*/30 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://sfxarvxtouzrhkuwcofu.supabase.co/functions/v1/send-daily-notifications',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
;
