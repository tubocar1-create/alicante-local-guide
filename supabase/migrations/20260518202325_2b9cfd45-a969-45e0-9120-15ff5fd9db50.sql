
CREATE TABLE public.hotels_static (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  liteapi_hotel_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  stars NUMERIC,
  hotel_type TEXT,
  neighborhood TEXT,
  distance_km NUMERIC,
  main_image TEXT,
  booking_url TEXT,
  amenities JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_hotels_static_coords ON public.hotels_static (lat, lng);
CREATE INDEX idx_hotels_static_stars ON public.hotels_static (stars);

ALTER TABLE public.hotels_static ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read hotels_static" ON public.hotels_static FOR SELECT USING (true);
CREATE POLICY "Admins manage hotels_static" ON public.hotels_static FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_hotels_static_updated
  BEFORE UPDATE ON public.hotels_static
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.hotels_dynamic (
  hotel_id UUID NOT NULL PRIMARY KEY REFERENCES public.hotels_static(id) ON DELETE CASCADE,
  available BOOLEAN NOT NULL DEFAULT false,
  current_price NUMERIC,
  currency TEXT DEFAULT 'EUR',
  breakfast_included BOOLEAN DEFAULT false,
  free_cancellation BOOLEAN DEFAULT false,
  rooms_available INTEGER,
  raw JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_hotels_dynamic_available_price ON public.hotels_dynamic (available, current_price);

ALTER TABLE public.hotels_dynamic ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read hotels_dynamic" ON public.hotels_dynamic FOR SELECT USING (true);
CREATE POLICY "Admins manage hotels_dynamic" ON public.hotels_dynamic FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_hotels_dynamic_updated
  BEFORE UPDATE ON public.hotels_dynamic
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
