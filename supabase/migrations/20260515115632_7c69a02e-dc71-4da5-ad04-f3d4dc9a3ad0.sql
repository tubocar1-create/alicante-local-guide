UPDATE public.bus_stops bs
SET lines = (
  SELECT ARRAY(
    SELECT DISTINCT x FROM unnest(
      COALESCE(bs.lines, ARRAY[]::text[]) ||
      ARRAY(SELECT DISTINCT bls.line_code FROM public.bus_line_stops bls WHERE bls.stop_code = bs.code)
    ) x
  )
)
WHERE bs.code IN (
  SELECT DISTINCT stop_code FROM public.bus_line_stops
  WHERE line_code IN ('22','27','28','39','24','3N','13N','22N')
);