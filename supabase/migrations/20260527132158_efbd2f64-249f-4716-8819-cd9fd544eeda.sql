UPDATE public.agente_respuestas SET question = CASE intent_id
  WHEN 'salud' THEN 'Te abro la sección de salud para que elijas en pantalla.'
  WHEN 'comer' THEN 'Te llevo a la sección para comer; elige el tipo en pantalla.'
  WHEN 'transporte' THEN 'Te abro la sección de transporte; elige el medio en pantalla.'
  WHEN 'transporte_bus' THEN 'Te abro el selector de buses para que elijas en pantalla.'
  WHEN 'bus_known' THEN 'Te abro el selector de líneas de bus.'
  WHEN 'tram_pick' THEN 'Te abro el TRAM; elige la estación en pantalla.'
  WHEN 'tram_origin_confirm' THEN 'Confirma la parada de origen en pantalla.'
  WHEN 'fiestas' THEN 'Te abro fiestas; elige la categoría en pantalla.'
  WHEN 'tomar_algo' THEN 'Te abro la sección para tomar algo; elige el ambiente en pantalla.'
  WHEN 'ocio' THEN 'Te abro ocio; elige la categoría en pantalla.'
  WHEN 'playas' THEN 'Te abro playas; elige carrusel o mapa en pantalla.'
  WHEN 'dormir' THEN 'Te abro alojamiento; elige el tipo en pantalla.'
  WHEN 'compras' THEN 'Te abro compras; elige el sector en pantalla.'
  WHEN 'mapa' THEN 'Te abro el mapa interactivo.'
  ELSE question
END
WHERE intent_id IN ('salud','comer','transporte','transporte_bus','bus_known','tram_pick','tram_origin_confirm','fiestas','tomar_algo','ocio','playas','dormir','compras','mapa');