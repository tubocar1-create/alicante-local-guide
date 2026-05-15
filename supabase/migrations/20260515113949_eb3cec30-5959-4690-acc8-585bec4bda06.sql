UPDATE public.bus_stops
SET lines = (
  SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(lines, ARRAY[]::text[]) || ARRAY['14']))
)
WHERE code IN (SELECT DISTINCT stop_code FROM public.bus_line_stops WHERE line_code='14' AND stop_code IS NOT NULL);