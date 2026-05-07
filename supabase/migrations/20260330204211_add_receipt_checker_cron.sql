
SELECT cron.schedule(
  'check-push-receipts',
  '15 */1 * * *',
  $$
    SELECT net.http_post(
      url := 'https://sfxarvxtouzrhkuwcofu.supabase.co/functions/v1/check-push-receipts',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
;
