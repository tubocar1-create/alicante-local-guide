CREATE TABLE IF NOT EXISTS public.tram_live_departures (
  stop_id text NOT NULL REFERENCES public.tram_stops(stop_id) ON DELETE CASCADE,
  trip_id text NOT NULL REFERENCES public.tram_trips(trip_id) ON DELETE CASCADE,
  route_id text NOT NULL REFERENCES public.tram_routes(route_id) ON DELETE CASCADE,
  service_id text NOT NULL,
  service_date date NOT NULL,
  headsign text,
  direction integer,
  line_short_name text,
  line_long_name text,
  line_color text,
  arrival_at timestamptz,
  departure_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (stop_id, trip_id, service_date, departure_at)
);

CREATE INDEX IF NOT EXISTS tram_live_departures_stop_departure_idx
  ON public.tram_live_departures (stop_id, departure_at);

CREATE INDEX IF NOT EXISTS tram_live_departures_service_date_idx
  ON public.tram_live_departures (service_date, departure_at);

ALTER TABLE public.tram_live_departures ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tram_live_departures'
      AND policyname = 'Public read tram_live_departures'
  ) THEN
    CREATE POLICY "Public read tram_live_departures"
      ON public.tram_live_departures
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tram_live_departures'
      AND policyname = 'Admins manage tram_live_departures'
  ) THEN
    CREATE POLICY "Admins manage tram_live_departures"
      ON public.tram_live_departures
      FOR ALL
      USING (public.has_role(auth.uid(), 'admin'::public.app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.refresh_tram_live_departures(
  p_from timestamptz DEFAULT now(),
  p_to timestamptz DEFAULT (now() + interval '3 hours')
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_from timestamptz := COALESCE(p_from, now());
  v_to timestamptz := COALESCE(p_to, now() + interval '3 hours');
  v_rows integer := 0;
BEGIN
  IF v_to <= v_from THEN
    v_to := v_from + interval '3 hours';
  END IF;

  DELETE FROM public.tram_live_departures
  WHERE departure_at < (v_from - interval '5 minutes')
     OR departure_at > v_to;

  WITH dates AS (
    SELECT generate_series(
      date_trunc('day', v_from)::date,
      date_trunc('day', v_to)::date,
      interval '1 day'
    )::date AS service_date
  ),
  base_services AS (
    SELECT d.service_date, c.service_id
    FROM dates d
    JOIN public.tram_calendar c
      ON d.service_date BETWEEN c.start_date AND c.end_date
    WHERE CASE EXTRACT(DOW FROM d.service_date)
      WHEN 0 THEN c.sunday
      WHEN 1 THEN c.monday
      WHEN 2 THEN c.tuesday
      WHEN 3 THEN c.wednesday
      WHEN 4 THEN c.thursday
      WHEN 5 THEN c.friday
      WHEN 6 THEN c.saturday
    END
  ),
  added_services AS (
    SELECT d.service_date, cd.service_id
    FROM dates d
    JOIN public.tram_calendar_dates cd
      ON cd.date = d.service_date
     AND cd.exception_type = 1
  ),
  removed_services AS (
    SELECT d.service_date, cd.service_id
    FROM dates d
    JOIN public.tram_calendar_dates cd
      ON cd.date = d.service_date
     AND cd.exception_type = 2
  ),
  active_services AS (
    SELECT service_date, service_id FROM base_services
    UNION
    SELECT service_date, service_id FROM added_services
  ),
  filtered_services AS (
    SELECT a.service_date, a.service_id
    FROM active_services a
    LEFT JOIN removed_services r
      ON r.service_date = a.service_date
     AND r.service_id = a.service_id
    WHERE r.service_id IS NULL
  ),
  source_rows AS (
    SELECT
      st.stop_id,
      t.trip_id,
      t.route_id,
      t.service_id,
      fs.service_date,
      t.trip_headsign AS headsign,
      t.direction_id AS direction,
      r.route_short_name AS line_short_name,
      r.route_long_name AS line_long_name,
      r.route_color AS line_color,
      ((fs.service_date::text || ' 00:00:00 Europe/Madrid')::timestamptz
        + make_interval(secs => COALESCE(st.arrival_seconds, st.departure_seconds))) AS arrival_at,
      ((fs.service_date::text || ' 00:00:00 Europe/Madrid')::timestamptz
        + make_interval(secs => st.departure_seconds)) AS departure_at
    FROM filtered_services fs
    JOIN public.tram_trips t
      ON t.service_id = fs.service_id
    JOIN public.tram_stop_times st
      ON st.trip_id = t.trip_id
    JOIN public.tram_routes r
      ON r.route_id = t.route_id
    WHERE st.departure_seconds IS NOT NULL
  ),
  bounded AS (
    SELECT *
    FROM source_rows
    WHERE departure_at >= (v_from - interval '5 minutes')
      AND departure_at <= v_to
  )
  INSERT INTO public.tram_live_departures (
    stop_id,
    trip_id,
    route_id,
    service_id,
    service_date,
    headsign,
    direction,
    line_short_name,
    line_long_name,
    line_color,
    arrival_at,
    departure_at
  )
  SELECT
    stop_id,
    trip_id,
    route_id,
    service_id,
    service_date,
    headsign,
    direction,
    line_short_name,
    line_long_name,
    line_color,
    arrival_at,
    departure_at
  FROM bounded
  ON CONFLICT (stop_id, trip_id, service_date, departure_at)
  DO UPDATE SET
    route_id = EXCLUDED.route_id,
    service_id = EXCLUDED.service_id,
    headsign = EXCLUDED.headsign,
    direction = EXCLUDED.direction,
    line_short_name = EXCLUDED.line_short_name,
    line_long_name = EXCLUDED.line_long_name,
    line_color = EXCLUDED.line_color,
    arrival_at = EXCLUDED.arrival_at;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  DELETE FROM public.tram_live_departures
  WHERE departure_at < (v_from - interval '5 minutes')
     OR departure_at > v_to;

  RETURN v_rows;
END;
$function$;

CREATE OR REPLACE FUNCTION public.purge_aena_flights(
  p_retention interval DEFAULT interval '2 hours'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_rows integer := 0;
BEGIN
  DELETE FROM public.aena_flights
  WHERE scheduled_at < (now() - COALESCE(p_retention, interval '2 hours'));

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$function$;

CREATE OR REPLACE FUNCTION public.purge_tram_expired_services()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_rows integer := 0;
  v_chunk integer := 0;
BEGIN
  DELETE FROM public.tram_stop_times st
  USING public.tram_trips t, public.tram_calendar c
  WHERE st.trip_id = t.trip_id
    AND t.service_id = c.service_id
    AND c.end_date < current_date;
  GET DIAGNOSTICS v_chunk = ROW_COUNT;
  v_rows := v_rows + v_chunk;

  DELETE FROM public.tram_trips t
  USING public.tram_calendar c
  WHERE t.service_id = c.service_id
    AND c.end_date < current_date;
  GET DIAGNOSTICS v_chunk = ROW_COUNT;
  v_rows := v_rows + v_chunk;

  DELETE FROM public.tram_calendar_dates cd
  WHERE cd.date < current_date
     OR EXISTS (
       SELECT 1
       FROM public.tram_calendar c
       WHERE c.service_id = cd.service_id
         AND c.end_date < current_date
     );
  GET DIAGNOSTICS v_chunk = ROW_COUNT;
  v_rows := v_rows + v_chunk;

  DELETE FROM public.tram_calendar c
  WHERE c.end_date < current_date;
  GET DIAGNOSTICS v_chunk = ROW_COUNT;
  v_rows := v_rows + v_chunk;

  RETURN v_rows;
END;
$function$;

SELECT public.purge_aena_flights(interval '2 hours');
SELECT public.purge_tram_expired_services();
SELECT public.refresh_tram_live_departures(now(), now() + interval '3 hours');