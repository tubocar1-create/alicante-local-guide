CREATE TABLE public.places_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  google_place_id text NOT NULL UNIQUE,
  name text NOT NULL,
  cuisine text,
  primary_type text,
  types text[],
  address text,
  lat double precision,
  lng double precision,
  opening_hours_text text,
  opening_hours_json jsonb,
  open_now boolean,
  price_level text,
  price_range_min integer,
  price_range_max integer,
  price_currency text,
  rating numeric,
  user_rating_count integer,
  phone text,
  website text,
  category text NOT NULL,
  raw jsonb,
  fetched_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_places_cache_category ON public.places_cache(category);
CREATE INDEX idx_places_cache_fetched_at ON public.places_cache(fetched_at);

ALTER TABLE public.places_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Places cache publicly readable"
ON public.places_cache
FOR SELECT
USING (true);

CREATE TRIGGER update_places_cache_updated_at
BEFORE UPDATE ON public.places_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();