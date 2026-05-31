
-- Generar departures dirección 1 para líneas nocturnas a partir de dirección 0
-- 3N y 13N: offset +30 min (PdM :30 → terminal opuesto :00)
INSERT INTO public.bus_line_departures (line_code, day_type, direction, departure_time, estimated, source)
SELECT line_code, day_type, 1,
       ((departure_time + interval '30 minutes')::time) AS departure_time,
       true, 'derived'
FROM public.bus_line_departures
WHERE line_code IN ('3N','13N') AND direction = 0;

-- 22N: offset +35 min (PdM :30 → PAU 5 :05)
INSERT INTO public.bus_line_departures (line_code, day_type, direction, departure_time, estimated, source)
SELECT line_code, day_type, 1,
       ((departure_time + interval '35 minutes')::time) AS departure_time,
       true, 'derived'
FROM public.bus_line_departures
WHERE line_code = '22N' AND direction = 0;
