
-- Función para purgar películas huérfanas (sin sesiones)
CREATE OR REPLACE FUNCTION public.purge_films_orphan()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows integer := 0;
BEGIN
  DELETE FROM public.films f
  WHERE NOT EXISTS (SELECT 1 FROM public.showtimes s WHERE s.film_id = f.id);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END; $$;

-- Función orquestadora: limpia todo lo viejo del día anterior y huérfanos
CREATE OR REPLACE FUNCTION public.purge_daily_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
BEGIN
  v_result := v_result || jsonb_build_object('showtimes_past', public.purge_showtimes_past(interval '1 day'));
  v_result := v_result || jsonb_build_object('films_orphan', public.purge_films_orphan());
  v_result := v_result || jsonb_build_object('event_showtimes_past', public.purge_event_showtimes_past(interval '1 day'));
  v_result := v_result || jsonb_build_object('events_orphan', public.purge_events_orphan());
  v_result := v_result || jsonb_build_object('aena_flights', public.purge_aena_flights(interval '2 hours'));
  v_result := v_result || jsonb_build_object('hotels_calendar', public.purge_hotels_calendar_past());
  v_result := v_result || jsonb_build_object('tram_expired', public.purge_tram_expired_services());
  v_result := v_result || jsonb_build_object('tram_keep_window', public.purge_tram_keep_window(1));
  v_result := v_result || jsonb_build_object('agente_unknown_queries', public.purge_agente_unknown_queries(interval '60 days'));
  v_result := v_result || jsonb_build_object('agente_unknown_query_actions', public.purge_agente_unknown_query_actions(interval '180 days'));
  v_result := v_result || jsonb_build_object('agente_learning_log', public.purge_agente_learning_log(interval '30 days'));
  v_result := v_result || jsonb_build_object('interaction_events', public.purge_interaction_events(interval '90 days'));
  v_result := v_result || jsonb_build_object('external_api_calls', public.purge_external_api_calls(interval '30 days'));
  v_result := v_result || jsonb_build_object('ad_variants_cache', public.purge_ad_variants_cache(interval '7 days'));
  v_result := v_result || jsonb_build_object('operational_event_reviews', public.purge_operational_event_reviews(interval '365 days'));
  v_result := v_result || jsonb_build_object('ran_at', now());
  RETURN v_result;
END; $$;

-- Habilitar pg_cron y programar limpieza diaria a las 03:15 UTC (~04:15/05:15 Madrid)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Desprogramar si ya existía
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-cleanup') THEN
    PERFORM cron.unschedule('daily-cleanup');
  END IF;
END $$;

SELECT cron.schedule(
  'daily-cleanup',
  '15 3 * * *',
  $$ SELECT public.purge_daily_cleanup(); $$
);

-- Ejecutar una vez ahora para limpiar lo viejo pendiente
SELECT public.purge_daily_cleanup();
