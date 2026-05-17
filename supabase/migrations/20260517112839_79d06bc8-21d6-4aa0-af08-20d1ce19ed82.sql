CREATE TABLE IF NOT EXISTS public.health_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  name text NOT NULL,
  address text,
  phone text,
  website text,
  lat double precision,
  lng double precision,
  rating numeric,
  user_ratings_total integer,
  photos text[] NOT NULL DEFAULT '{}',
  google_place_id text UNIQUE,
  opening_hours jsonb,
  price_level text,
  notes text,
  source text NOT NULL DEFAULT 'google',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_providers_category ON public.health_providers(category);

ALTER TABLE public.health_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read health_providers"
  ON public.health_providers FOR SELECT
  USING (true);

CREATE POLICY "Admins manage health_providers"
  ON public.health_providers FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_health_providers_updated_at
  BEFORE UPDATE ON public.health_providers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();