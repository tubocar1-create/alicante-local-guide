CREATE TABLE IF NOT EXISTS public.alsa_schedules (
  id BIGSERIAL PRIMARY KEY,
  route_slug TEXT NOT NULL,
  direction CHAR(1) NOT NULL CHECK (direction IN ('S','L')),
  service_date DATE NOT NULL,
  departure_time TEXT NOT NULL,
  arrival_time TEXT NOT NULL,
  duration_minutes INT NOT NULL,
  origin_station TEXT NOT NULL,
  destination_station TEXT NOT NULL,
  bus_type TEXT,
  price_from_eur NUMERIC(7,2),
  promo_price_eur NUMERIC(7,2),
  observations JSONB,
  source_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alsa_schedules_route_date
  ON public.alsa_schedules (route_slug, direction, service_date, departure_time);

CREATE UNIQUE INDEX IF NOT EXISTS uq_alsa_schedules_dedupe
  ON public.alsa_schedules (route_slug, direction, service_date, departure_time, origin_station, destination_station);

GRANT SELECT ON public.alsa_schedules TO anon, authenticated;
GRANT ALL ON public.alsa_schedules TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.alsa_schedules_id_seq TO service_role;

ALTER TABLE public.alsa_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alsa_schedules public read"
  ON public.alsa_schedules
  FOR SELECT
  TO anon, authenticated
  USING (true);