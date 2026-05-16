CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Si existía una versión previa, la quitamos para evitar duplicados.
DO $$
BEGIN
  PERFORM cron.unschedule('refresh-alicante-press-daily');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'refresh-alicante-press-daily',
  '0 2 * * *', -- 02:00 UTC = 03:00 Madrid (invierno) / 04:00 (verano)
  $$
  SELECT net.http_post(
    url := 'https://project--a8ec37f9-59bf-4ebb-a372-974e51dc0567.lovable.app/api/public/refresh-alicante-press',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);