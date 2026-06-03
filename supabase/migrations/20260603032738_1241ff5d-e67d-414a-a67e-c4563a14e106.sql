-- ============================================================
-- BUS LARGA DISTANCIA — esquema base (espejo de /trenes)
-- ============================================================

-- 1) Estaciones (orígenes ALC + destinos)
CREATE TABLE public.bus_ld_stations (
  id           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,            -- p.ej. "ALC-BUS", "ALC-APT", "BEN", "VLC"
  city         TEXT NOT NULL,                   -- "Alicante", "Benidorm"
  station      TEXT NOT NULL,                   -- "Estación de Autobuses", "Aeropuerto Alicante-Elche"
  kind         TEXT NOT NULL DEFAULT 'destination'
                 CHECK (kind IN ('origin', 'destination')),
  lat          DOUBLE PRECISION,
  lng          DOUBLE PRECISION,
  operators    TEXT[] NOT NULL DEFAULT '{}'::text[],
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bus_ld_stations TO anon;
GRANT SELECT ON public.bus_ld_stations TO authenticated;
GRANT ALL ON public.bus_ld_stations TO service_role;

ALTER TABLE public.bus_ld_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bus_ld_stations public read"
  ON public.bus_ld_stations FOR SELECT
  USING (true);

CREATE TRIGGER trg_bus_ld_stations_updated_at
  BEFORE UPDATE ON public.bus_ld_stations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Rutas (origen → destino)
CREATE TABLE public.bus_ld_routes (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  origin_code     TEXT NOT NULL REFERENCES public.bus_ld_stations(code) ON DELETE CASCADE,
  destination_code TEXT NOT NULL REFERENCES public.bus_ld_stations(code) ON DELETE CASCADE,
  corridor        TEXT,                         -- agrupador visual: "COSTA-NORTE", "INTERIOR", "MURCIA", etc.
  label           TEXT,                         -- p.ej. "Alicante Bus → Benidorm"
  operators       TEXT[] NOT NULL DEFAULT '{}'::text[],
  is_popular      BOOLEAN NOT NULL DEFAULT false,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (origin_code, destination_code)
);

CREATE INDEX idx_bus_ld_routes_origin ON public.bus_ld_routes(origin_code);
CREATE INDEX idx_bus_ld_routes_corridor ON public.bus_ld_routes(corridor);

GRANT SELECT ON public.bus_ld_routes TO anon;
GRANT SELECT ON public.bus_ld_routes TO authenticated;
GRANT ALL ON public.bus_ld_routes TO service_role;

ALTER TABLE public.bus_ld_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bus_ld_routes public read"
  ON public.bus_ld_routes FOR SELECT
  USING (true);

CREATE TRIGGER trg_bus_ld_routes_updated_at
  BEFORE UPDATE ON public.bus_ld_routes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Servicios (cada bus concreto de un día)
CREATE TABLE public.bus_ld_services (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id        UUID NOT NULL REFERENCES public.bus_ld_routes(id) ON DELETE CASCADE,
  service_date    DATE NOT NULL,                 -- día del servicio (Europe/Madrid)
  service_number  TEXT,                          -- nº de bus del operador
  operator        TEXT NOT NULL,                 -- "ALSA", "Avanza", "Vectalia", ...
  product         TEXT,                          -- "Premium", "Supra", "Normal", ...
  departure_time  TIME NOT NULL,                 -- hora salida (local)
  arrival_time    TIME,                          -- hora llegada (local, mismo día o siguiente)
  duration_min    INTEGER,                       -- duración estimada
  origin_stop     TEXT,                          -- texto del andén/origen exacto si difiere
  destination_stop TEXT,
  stops           JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{name, arr, dep, code?}]
  price_from_eur  NUMERIC(8,2),
  booking_url     TEXT,
  source          TEXT,                          -- 'alsa', 'avanza', 'manual', ...
  raw             JSONB,                         -- payload bruto del scraper si aplica
  is_active       BOOLEAN NOT NULL DEFAULT true,
  fetched_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (route_id, service_date, operator, departure_time, service_number)
);

CREATE INDEX idx_bus_ld_services_route_date ON public.bus_ld_services(route_id, service_date);
CREATE INDEX idx_bus_ld_services_date ON public.bus_ld_services(service_date);

GRANT SELECT ON public.bus_ld_services TO anon;
GRANT SELECT ON public.bus_ld_services TO authenticated;
GRANT ALL ON public.bus_ld_services TO service_role;

ALTER TABLE public.bus_ld_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bus_ld_services public read"
  ON public.bus_ld_services FOR SELECT
  USING (true);

CREATE TRIGGER trg_bus_ld_services_updated_at
  BEFORE UPDATE ON public.bus_ld_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Seed mínimo: las dos estaciones origen
INSERT INTO public.bus_ld_stations (code, city, station, kind, lat, lng, operators)
VALUES
  ('ALC-BUS', 'Alicante', 'Estación de Autobuses de Alicante', 'origin', 38.3438, -0.4906, '{}'),
  ('ALC-APT', 'Alicante', 'Aeropuerto Alicante-Elche', 'origin', 38.2822, -0.5582, '{}')
ON CONFLICT (code) DO NOTHING;