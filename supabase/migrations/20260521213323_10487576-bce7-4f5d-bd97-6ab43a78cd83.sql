UPDATE public.shop_businesses
SET opening_hours = jsonb_build_object(
  'assumed', true,
  'openNow', null,
  'weekdayDescriptions', jsonb_build_array(
    'lunes: 9:00–14:00, 17:00–19:00',
    'martes: 9:00–14:00, 17:00–19:00',
    'miércoles: 9:00–14:00, 17:00–19:00',
    'jueves: 9:00–14:00, 17:00–19:00',
    'viernes: 9:00–14:00, 17:00–19:00',
    'sábado: 9:00–14:00, 17:00–19:00',
    'domingo: cerrado'
  ),
  'periods', jsonb_build_array(
    jsonb_build_object('open', jsonb_build_object('day',1,'hour',9,'minute',0),  'close', jsonb_build_object('day',1,'hour',14,'minute',0)),
    jsonb_build_object('open', jsonb_build_object('day',1,'hour',17,'minute',0), 'close', jsonb_build_object('day',1,'hour',19,'minute',0)),
    jsonb_build_object('open', jsonb_build_object('day',2,'hour',9,'minute',0),  'close', jsonb_build_object('day',2,'hour',14,'minute',0)),
    jsonb_build_object('open', jsonb_build_object('day',2,'hour',17,'minute',0), 'close', jsonb_build_object('day',2,'hour',19,'minute',0)),
    jsonb_build_object('open', jsonb_build_object('day',3,'hour',9,'minute',0),  'close', jsonb_build_object('day',3,'hour',14,'minute',0)),
    jsonb_build_object('open', jsonb_build_object('day',3,'hour',17,'minute',0), 'close', jsonb_build_object('day',3,'hour',19,'minute',0)),
    jsonb_build_object('open', jsonb_build_object('day',4,'hour',9,'minute',0),  'close', jsonb_build_object('day',4,'hour',14,'minute',0)),
    jsonb_build_object('open', jsonb_build_object('day',4,'hour',17,'minute',0), 'close', jsonb_build_object('day',4,'hour',19,'minute',0)),
    jsonb_build_object('open', jsonb_build_object('day',5,'hour',9,'minute',0),  'close', jsonb_build_object('day',5,'hour',14,'minute',0)),
    jsonb_build_object('open', jsonb_build_object('day',5,'hour',17,'minute',0), 'close', jsonb_build_object('day',5,'hour',19,'minute',0)),
    jsonb_build_object('open', jsonb_build_object('day',6,'hour',9,'minute',0),  'close', jsonb_build_object('day',6,'hour',14,'minute',0)),
    jsonb_build_object('open', jsonb_build_object('day',6,'hour',17,'minute',0), 'close', jsonb_build_object('day',6,'hour',19,'minute',0))
  )
)
WHERE opening_hours IS NULL
   OR opening_hours->'weekdayDescriptions' IS NULL
   OR jsonb_array_length(COALESCE(opening_hours->'weekdayDescriptions', '[]'::jsonb)) = 0;