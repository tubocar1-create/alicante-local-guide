
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Quitar versión previa si ya existía
SELECT cron.unschedule('refresh-incidencias-daily-7am')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-incidencias-daily-7am');

SELECT cron.schedule(
  'refresh-incidencias-daily-7am',
  '0 6 * * *', -- 06:00 UTC = 07:00 hora peninsular (invierno) / 08:00 (verano)
  $$
  SELECT net.http_post(
    url := 'https://project--a8ec37f9-59bf-4ebb-a372-974e51dc0567.lovable.app/api/public/refresh-incidencias',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
