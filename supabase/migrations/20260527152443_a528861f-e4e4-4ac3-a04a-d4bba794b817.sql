
-- Reduce TRAM GTFS footprint: keep only services active for today + tomorrow.
CREATE OR REPLACE FUNCTION public.purge_tram_keep_window(p_days integer DEFAULT 1)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Europe/Madrid')::date;
  v_end   date := ((now() AT TIME ZONE 'Europe/Madrid')::date) + GREATEST(COALESCE(p_days, 1), 0);
  v_rows integer := 0;
  v_chunk integer := 0;
BEGIN
  -- Compute set of services that actually run on any day in [today, v_end].
  CREATE TEMP TABLE IF NOT EXISTS _tram_keep_services (service_id text PRIMARY KEY) ON COMMIT DROP;
  TRUNCATE _tram_keep_services;

  WITH dates AS (
    SELECT generate_series(v_today, v_end, interval '1 day')::date AS d
  ),
  base AS (
    SELECT c.service_id
    FROM dates dt
    JOIN public.tram_calendar c
      ON dt.d BETWEEN c.start_date AND c.end_date
    WHERE CASE EXTRACT(DOW FROM dt.d)
      WHEN 0 THEN c.sunday WHEN 1 THEN c.monday WHEN 2 THEN c.tuesday
      WHEN 3 THEN c.wednesday WHEN 4 THEN c.thursday WHEN 5 THEN c.friday
      WHEN 6 THEN c.saturday END
  ),
  added AS (
    SELECT cd.service_id
    FROM dates dt
    JOIN public.tram_calendar_dates cd
      ON cd.date = dt.d AND cd.exception_type = 1
  )
  INSERT INTO _tram_keep_services(service_id)
  SELECT DISTINCT service_id FROM (SELECT service_id FROM base UNION SELECT service_id FROM added) s
  ON CONFLICT DO NOTHING;

  -- Delete stop_times whose trip belongs to a service we are not keeping.
  DELETE FROM public.tram_stop_times st
  USING public.tram_trips t
  WHERE st.trip_id = t.trip_id
    AND t.service_id NOT IN (SELECT service_id FROM _tram_keep_services);
  GET DIAGNOSTICS v_chunk = ROW_COUNT; v_rows := v_rows + v_chunk;

  -- Delete trips of non-kept services.
  DELETE FROM public.tram_trips
  WHERE service_id NOT IN (SELECT service_id FROM _tram_keep_services);
  GET DIAGNOSTICS v_chunk = ROW_COUNT; v_rows := v_rows + v_chunk;

  -- Delete calendar_dates outside the window OR for non-kept services.
  DELETE FROM public.tram_calendar_dates cd
  WHERE cd.date < v_today
     OR cd.date > v_end
     OR cd.service_id NOT IN (SELECT service_id FROM _tram_keep_services);
  GET DIAGNOSTICS v_chunk = ROW_COUNT; v_rows := v_rows + v_chunk;

  -- Delete calendar rows for non-kept services.
  DELETE FROM public.tram_calendar
  WHERE service_id NOT IN (SELECT service_id FROM _tram_keep_services);
  GET DIAGNOSTICS v_chunk = ROW_COUNT; v_rows := v_rows + v_chunk;

  -- Shapes: keep only those referenced by remaining trips.
  DELETE FROM public.tram_shapes s
  WHERE s.shape_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.tram_trips t WHERE t.shape_id = s.shape_id);
  GET DIAGNOSTICS v_chunk = ROW_COUNT; v_rows := v_rows + v_chunk;

  RETURN v_rows;
END;
$$;
