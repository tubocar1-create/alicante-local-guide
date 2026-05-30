
CREATE OR REPLACE FUNCTION public.purge_daily_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
BEGIN
  -- Cines
  v_result := v_result || jsonb_build_object('showtimes_past', public.purge_showtimes_past(interval '1 day'));
  v_result := v_result || jsonb_build_object('films_orphan', public.purge_films_orphan());
  -- Eventos
  v_result := v_result || jsonb_build_object('event_showtimes_past', public.purge_event_showtimes_past(interval '1 day'));
  v_result := v_result || jsonb_build_object('events_orphan', public.purge_events_orphan());
  -- Vuelos
  v_result := v_result || jsonb_build_object('aena_flights', public.purge_aena_flights(interval '2 hours'));
  -- Hoteles
  v_result := v_result || jsonb_build_object('hotels_calendar', public.purge_hotels_calendar_past());
  -- Tranvía
  v_result := v_result || jsonb_build_object('tram_expired', public.purge_tram_expired_services());
  v_result := v_result || jsonb_build_object('tram_keep_window', public.purge_tram_keep_window(1));
  -- Agente / logs
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

-- Ejecutar una vez ahora para dejar todo limpio
SELECT public.purge_daily_cleanup();
