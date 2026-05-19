
CREATE TABLE public.agente_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  route text,
  action text,
  keywords text[] NOT NULL DEFAULT '{}',
  spoken_reply text NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agente_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active intents"
  ON public.agente_intents FOR SELECT
  USING (active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage intents"
  ON public.agente_intents FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_agente_intents_updated
  BEFORE UPDATE ON public.agente_intents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_agente_intents_active_priority
  ON public.agente_intents (active, priority);

INSERT INTO public.agente_intents (key, label, route, action, keywords, spoken_reply, priority) VALUES
  ('comer',         'Comer',                    '/explore?cat=eat',     NULL,      ARRAY['comer','restaurante','restaurantes','comida','almorzar','cenar','desayunar','tapas','menu','menú'], 'Te llevo a dónde comer.', 10),
  ('dormir',        'Dormir',                   '/donde-dormir',        NULL,      ARRAY['dormir','hotel','hoteles','hostal','alojamiento','apartamento','airbnb','hospedaje'], 'Te llevo a dónde dormir.', 20),
  ('playas',        'Playas',                   '/playas',              NULL,      ARRAY['playa','playas','cala','calas','baño','arena','mar'], 'Te llevo a las playas.', 30),
  ('comprar',       'Comprar',                  '/explore?cat=shop',    NULL,      ARRAY['comprar','tiendas','tienda','shopping','centro comercial','mercado','souvenir','souvenirs'], 'Te llevo a dónde comprar.', 40),
  ('tomar_algo',    'Tomar algo',               '/explore?cat=drink',   NULL,      ARRAY['tomar algo','copa','copas','beber','bar','bares','pub','pubs','cerveza','vino','cóctel','coctel','cafetería','cafeteria','café'], 'Te llevo a dónde tomar algo.', 50),
  ('transporte',    'Transporte',               '/bus',                 NULL,      ARRAY['transporte','bus','autobús','autobus','tram','tranvía','tranvia','vuelo','vuelos','aeropuerto','taxi','metro','llegar','cómo llegar','como llegar'], 'Te llevo al transporte.', 60),
  ('mapa',          'Mapa',                     '/explore',             NULL,      ARRAY['mapa','explorar','explore','ver mapa','dónde está','donde esta','ubicación','ubicacion'], 'Abro el mapa.', 70),
  ('salud',         'Salud',                    '/salud',               NULL,      ARRAY['salud','médico','medico','hospital','hospitales','farmacia','farmacias','urgencias','clínica','clinica','dentista'], 'Te llevo a salud.', 80),
  ('ocio',          'Ocio',                     '/ocio',                NULL,      ARRAY['ocio','cine','cines','película','pelicula','concierto','conciertos','teatro','teatros','espectáculo','espectaculo','plan','planes'], 'Te llevo al ocio.', 90),
  ('fiestas',       'Fiestas',                  '/fiestas',             NULL,      ARRAY['fiesta','fiestas','hogueras','san juan','moros y cristianos','programa','feria','verbena'], 'Te llevo a las fiestas.', 100),
  ('perfil',        'Perfil',                   '/perfil',              NULL,      ARRAY['perfil','mi cuenta','cuenta','mis datos','ajustes','configuración','configuracion'], 'Abro tu perfil.', 110),
  ('clima',         'Clima',                    '/clima',               NULL,      ARRAY['clima','tiempo','temperatura','lluvia','calor','frío','frio','pronóstico','pronostico','meteorología','meteorologia'], 'Te llevo al clima.', 120),
  ('reservas',      'Notificaciones y reservas','/business/bookings',    NULL,      ARRAY['reserva','reservas','notificación','notificaciones','aviso','avisos','mis reservas','booking'], 'Abro tus notificaciones y reservas.', 130),
  ('qr',            'QR',                       '/business/qr',          NULL,      ARRAY['qr','código qr','codigo qr','escanear','escáner','escaner'], 'Abro tu QR.', 140),
  ('salir',         'Salir',                    NULL,                    'logout',  ARRAY['salir','cerrar sesión','cerrar sesion','logout','desconectar','log out'], 'Cierro sesión.', 150);
