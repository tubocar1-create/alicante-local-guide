DO $$
DECLARE
  r RECORD;
  arr_time time;
  jaime time;
  europa time;
  estacion time;
  new_obs jsonb;
BEGIN
  FOR r IN
    SELECT id, arrival_time, observations
    FROM public.alsa_schedules
    WHERE route_slug = 'alicante-benidorm'
      AND direction = 'S'
      AND NOT (observations::text LIKE '%Jaime I%')
  LOOP
    arr_time := r.arrival_time;
    estacion := arr_time;
    europa := (arr_time - interval '10 minutes')::time;
    jaime := (arr_time - interval '20 minutes')::time;

    new_obs := '[]'::jsonb;
    -- preserve Renfe pickup line if present
    IF r.observations::text LIKE '%Renfe%' THEN
      new_obs := new_obs || to_jsonb((
        SELECT v FROM jsonb_array_elements_text(r.observations) v
        WHERE v LIKE '%Renfe%' LIMIT 1
      ));
    END IF;
    new_obs := new_obs || to_jsonb(
      'Paradas en Benidorm: Jaime I ' || to_char(jaime,'HH24:MI')
      || ' · Av. Europa ' || to_char(europa,'HH24:MI')
      || ' · Estación de Autobuses ' || to_char(estacion,'HH24:MI')
    );
    new_obs := new_obs || to_jsonb('Última parada: Benidorm ' || to_char(estacion,'HH24:MI'));

    UPDATE public.alsa_schedules SET observations = new_obs WHERE id = r.id;
  END LOOP;
END $$;