
SELECT cron.schedule(
  'evening-reminder',
  '*/30 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://sfxarvxtouzrhkuwcofu.supabase.co/functions/v1/send-evening-reminder',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
