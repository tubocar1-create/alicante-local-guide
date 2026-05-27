
UPDATE public.agente_intents SET route = '/tram' WHERE key = 'transporte';
UPDATE public.agente_intents SET route = '/playas' WHERE key IN ('Opciones','Opciones_playas','Playas');
