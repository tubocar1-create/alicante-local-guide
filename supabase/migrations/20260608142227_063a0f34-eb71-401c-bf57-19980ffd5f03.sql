SELECT cron.schedule(
  'refresh-renfe-snapshot-daily',
  '15 2 * * *',
  $$ SELECT net.http_post(
    url := 'https://project--htzatsqihojttrwsawis.lovable.app/api/public/hooks/refresh-renfe-snapshot',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ); $$
);