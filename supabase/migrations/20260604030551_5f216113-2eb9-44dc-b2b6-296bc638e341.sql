
-- Tabla de patrones recurrentes para alsa_schedules (resistentes al rollover diario)
CREATE TABLE IF NOT EXISTS public.alsa_schedule_patterns (
  id BIGSERIAL PRIMARY KEY,
  route_slug TEXT NOT NULL,
  direction CHAR(1) NOT NULL CHECK (direction IN ('S','L')),
  dow_mask SMALLINT[] NOT NULL, -- 0=dom..6=sáb. Vacío/NULL no permitido; usa {0,1,2,3,4,5,6} para diario.
  departure_time TIME NOT NULL,
  arrival_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL,
  origin_station TEXT NOT NULL,
  destination_station TEXT NOT NULL,
  bus_type TEXT,
  price_from_eur NUMERIC(6,2),
  promo_price_eur NUMERIC(6,2),
  observations JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_alsa_pattern
  ON public.alsa_schedule_patterns
  (route_slug, direction, departure_time, origin_station, destination_station, arrival_time);

GRANT SELECT ON public.alsa_schedule_patterns TO anon, authenticated;
GRANT ALL ON public.alsa_schedule_patterns TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.alsa_schedule_patterns_id_seq TO service_role;

ALTER TABLE public.alsa_schedule_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alsa_schedule_patterns public read"
  ON public.alsa_schedule_patterns FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TRIGGER trg_alsa_schedule_patterns_updated_at
  BEFORE UPDATE ON public.alsa_schedule_patterns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Función que reinyecta la ventana de p_days días aplicando los patrones activos.
CREATE OR REPLACE FUNCTION public.ensure_alsa_pattern_window(p_days INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'Europe/Madrid')::date;
  v_end DATE := v_today + GREATEST(COALESCE(p_days, 30) - 1, 0);
  v_inserted INTEGER := 0;
BEGIN
  WITH dates AS (
    SELECT generate_series(v_today, v_end, interval '1 day')::date AS d
  ),
  to_insert AS (
    SELECT
      p.route_slug,
      p.direction,
      d.d AS service_date,
      p.departure_time,
      p.arrival_time,
      p.duration_minutes,
      p.origin_station,
      p.destination_station,
      p.bus_type,
      p.price_from_eur,
      p.promo_price_eur,
      p.observations,
      v_today AS source_date
    FROM dates d
    JOIN public.alsa_schedule_patterns p
      ON p.active = true
     AND EXTRACT(DOW FROM d.d)::smallint = ANY(p.dow_mask)
  )
  INSERT INTO public.alsa_schedules
    (route_slug, direction, service_date, departure_time, arrival_time,
     duration_minutes, origin_station, destination_station, bus_type,
     price_from_eur, promo_price_eur, observations, source_date)
  SELECT * FROM to_insert
  ON CONFLICT (route_slug, direction, service_date, departure_time, origin_station, destination_station, arrival_time)
  DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

-- Engancha al cleanup diario para mantener la ventana de 30 días siempre completa.
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
  -- Rollover de patrones manuales de ALSA (mantiene la ventana de 30 días siempre completa)
  v_result := v_result || jsonb_build_object('alsa_pattern_window', public.ensure_alsa_pattern_window(30));
  v_result := v_result || jsonb_build_object('ran_at', now());
  RETURN v_result;
END;
$$;

-- Seed: ficha del viernes 06:00 Alicante → Benidorm
INSERT INTO public.alsa_schedule_patterns
  (route_slug, direction, dow_mask, departure_time, arrival_time, duration_minutes,
   origin_station, destination_station, bus_type, price_from_eur, observations, notes)
VALUES
  ('alicante-benidorm', 'S', ARRAY[5]::smallint[], '06:00', '07:00', 60,
   'Alicante Estación de Buses', 'Benidorm Estación de Autobuses',
   'Comfort', 6.55,
   '["Alicante Estación Tren 06:10"]'::jsonb,
   'Servicio solo viernes. Añadido manualmente; protegido del rollover.')
ON CONFLICT (route_slug, direction, departure_time, origin_station, destination_station, arrival_time)
DO NOTHING;

-- Aplica el patrón inmediatamente sobre la ventana actual.
SELECT public.ensure_alsa_pattern_window(30);
