DO $$
DECLARE
  r RECORD;
  dep_estacion time;
  dep_europa time;
  dep_jaime time;
  new_obs jsonb;
  renfe_line text;
BEGIN
  FOR r IN
    SELECT id, departure_time, arrival_time, observations
    FROM public.alsa_schedules
    WHERE route_slug = 'alicante-benidorm'
      AND direction = 'L'
      AND NOT (observations::text LIKE '%Jaime I%')
  LOOP
    dep_estacion := r.departure_time;
    dep_europa := (r.departure_time::time + interval '10 minutes')::time;
    dep_jaime := (r.departure_time::time + interval '20 minutes')::time;

    -- Preserve Renfe line if present
    SELECT obs INTO renfe_line
    FROM jsonb_array_elements_text(r.observations) AS obs
    WHERE obs LIKE '%Renfe%' OR obs LIKE '%Estación de Tren%'
    LIMIT 1;

    new_obs := jsonb_build_array(
      'Paradas de salida en Benidorm: Estación de Autobuses ' || to_char(dep_estacion, 'HH24:MI')
        || ' · Av. Europa ' || to_char(dep_europa, 'HH24:MI')
        || ' · Jaime I ' || to_char(dep_jaime, 'HH24:MI')
    );

    IF renfe_line IS NOT NULL THEN
      new_obs := new_obs || jsonb_build_array(renfe_line);
    END IF;

    new_obs := new_obs || jsonb_build_array(
      'Última parada: Alicante Estación de Buses ' || to_char(r.arrival_time::time, 'HH24:MI')
    );

    UPDATE public.alsa_schedules SET observations = new_obs WHERE id = r.id;
  END LOOP;
END $$;