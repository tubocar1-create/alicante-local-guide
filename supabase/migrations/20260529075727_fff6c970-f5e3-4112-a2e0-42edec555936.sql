ALTER TABLE public.pharmacies
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS geocoded_at timestamptz;

CREATE INDEX IF NOT EXISTS pharmacies_lat_lng_idx ON public.pharmacies (lat, lng);