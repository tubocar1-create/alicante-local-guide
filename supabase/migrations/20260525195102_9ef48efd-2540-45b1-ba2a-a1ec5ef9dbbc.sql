
-- Ensure extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1. interaction_events: 90 days
CREATE OR REPLACE FUNCTION public.purge_interaction_events(p_retention interval DEFAULT '90 days')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows integer := 0;
BEGIN
  DELETE FROM public.interaction_events WHERE occurred_at < (now() - COALESCE(p_retention, interval '90 days'));
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END; $$;

-- 2. agente_learning_log: 30 days
CREATE OR REPLACE FUNCTION public.purge_agente_learning_log(p_retention interval DEFAULT '30 days')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows integer := 0;
BEGIN
  DELETE FROM public.agente_learning_log WHERE created_at < (now() - COALESCE(p_retention, interval '30 days'));
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END; $$;

-- 3. agente_unknown_queries: 60 days
CREATE OR REPLACE FUNCTION public.purge_agente_unknown_queries(p_retention interval DEFAULT '60 days')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows integer := 0;
BEGIN
  DELETE FROM public.agente_unknown_queries WHERE last_seen_at < (now() - COALESCE(p_retention, interval '60 days'));
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END; $$;

-- 4. agente_unknown_query_actions: 180 days
CREATE OR REPLACE FUNCTION public.purge_agente_unknown_query_actions(p_retention interval DEFAULT '180 days')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows integer := 0;
BEGIN
  DELETE FROM public.agente_unknown_query_actions WHERE performed_at < (now() - COALESCE(p_retention, interval '180 days'));
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END; $$;

-- 5. operational_event_reviews: 365 days
CREATE OR REPLACE FUNCTION public.purge_operational_event_reviews(p_retention interval DEFAULT '365 days')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows integer := 0;
BEGIN
  DELETE FROM public.operational_event_reviews WHERE created_at < (now() - COALESCE(p_retention, interval '365 days'));
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END; $$;

-- 6. hotels_calendar: past dates
CREATE OR REPLACE FUNCTION public.purge_hotels_calendar_past()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows integer := 0;
BEGIN
  DELETE FROM public.hotels_calendar WHERE date < current_date;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END; $$;

-- 7. showtimes: >7 days past
CREATE OR REPLACE FUNCTION public.purge_showtimes_past(p_retention interval DEFAULT '7 days')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows integer := 0;
BEGIN
  DELETE FROM public.showtimes WHERE starts_at < (now() - COALESCE(p_retention, interval '7 days'));
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END; $$;

-- Unschedule existing jobs if present (idempotent)
DO $$
DECLARE j text;
BEGIN
  FOR j IN SELECT jobname FROM cron.job WHERE jobname IN (
    'purge-interaction-events-daily',
    'purge-agente-learning-log-daily',
    'purge-agente-unknown-queries-daily',
    'purge-agente-unknown-query-actions-daily',
    'purge-operational-event-reviews-daily',
    'purge-hotels-calendar-daily',
    'purge-showtimes-daily'
  ) LOOP
    PERFORM cron.unschedule(j);
  END LOOP;
END $$;

-- Schedule daily purges (staggered between 03:00-03:30 UTC)
SELECT cron.schedule('purge-interaction-events-daily', '0 3 * * *', $$SELECT public.purge_interaction_events();$$);
SELECT cron.schedule('purge-agente-learning-log-daily', '5 3 * * *', $$SELECT public.purge_agente_learning_log();$$);
SELECT cron.schedule('purge-agente-unknown-queries-daily', '10 3 * * *', $$SELECT public.purge_agente_unknown_queries();$$);
SELECT cron.schedule('purge-agente-unknown-query-actions-daily', '15 3 * * *', $$SELECT public.purge_agente_unknown_query_actions();$$);
SELECT cron.schedule('purge-operational-event-reviews-daily', '20 3 * * *', $$SELECT public.purge_operational_event_reviews();$$);
SELECT cron.schedule('purge-hotels-calendar-daily', '25 3 * * *', $$SELECT public.purge_hotels_calendar_past();$$);
SELECT cron.schedule('purge-showtimes-daily', '30 3 * * *', $$SELECT public.purge_showtimes_past();$$);
