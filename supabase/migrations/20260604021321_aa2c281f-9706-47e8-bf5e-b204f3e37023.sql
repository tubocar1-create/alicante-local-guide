
UPDATE public.alsa_schedules
SET destination_station = 'Aeropuerto Madrid - Barajas T4',
    arrival_time = '21:15',
    duration_minutes = 300,
    observations = '{"badge":"Más rápido","stops":[
      {"name":"Alicante Estación Autobús","province":"Alicante","time":"16:15","type":"salida"},
      {"name":"Albacete","province":"Albacete","time":"18:05","type":"parada"},
      {"name":"Madrid Estación Sur","province":"Madrid","time":"20:55","type":"parada"},
      {"name":"Aeropuerto Madrid - Barajas T4","province":"Madrid","time":"21:15","type":"llegada"}
    ]}'::jsonb
WHERE route_slug = 'alicante-madrid'
  AND direction = 'S'
  AND departure_time = '16:15';
