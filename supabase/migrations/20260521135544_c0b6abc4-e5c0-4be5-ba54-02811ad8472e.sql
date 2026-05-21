
CREATE TABLE IF NOT EXISTS public.shop_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  city text NOT NULL DEFAULT 'Alicante',
  description text,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_zones public read"
  ON public.shop_zones FOR SELECT
  USING (true);

CREATE POLICY "shop_zones admin write"
  ON public.shop_zones FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_shop_zones_updated_at
  BEFORE UPDATE ON public.shop_zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.shop_zones (slug, name, sort_order) VALUES
  ('maisonnave', 'Avenida Maisonnave', 10),
  ('federico-soto', 'Avenida Federico Soto', 20),
  ('alfonso-el-sabio', 'Avenida Alfonso el Sabio', 30),
  ('mendez-nunez', 'Rambla Méndez Núñez', 40)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.shop_businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text,
  zone_id uuid REFERENCES public.shop_zones(id) ON DELETE SET NULL,
  subsubsector_id uuid REFERENCES public.shop_subsubsectors(id) ON DELETE SET NULL,
  intent_id uuid REFERENCES public.shop_intents(id) ON DELETE SET NULL,
  address text,
  city text DEFAULT 'Alicante',
  postal_code text,
  phone text,
  website text,
  opening_hours jsonb,                 -- {"weekday_text":[...], "periods":[...]}
  price_level int CHECK (price_level BETWEEN 0 AND 4),
  rating numeric(2,1),
  user_ratings_total int,
  lat double precision,
  lng double precision,
  google_place_id text UNIQUE,
  google_types text[],
  photos jsonb,                        -- [{photo_reference, width, height, attribution}]
  status text NOT NULL DEFAULT 'pending', -- pending | enriched | failed | manual
  last_enriched_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_businesses_zone ON public.shop_businesses(zone_id);
CREATE INDEX IF NOT EXISTS idx_shop_businesses_subsub ON public.shop_businesses(subsubsector_id);
CREATE INDEX IF NOT EXISTS idx_shop_businesses_intent ON public.shop_businesses(intent_id);
CREATE INDEX IF NOT EXISTS idx_shop_businesses_status ON public.shop_businesses(status);

ALTER TABLE public.shop_businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_businesses public read"
  ON public.shop_businesses FOR SELECT
  USING (true);

CREATE POLICY "shop_businesses admin write"
  ON public.shop_businesses FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_shop_businesses_updated_at
  BEFORE UPDATE ON public.shop_businesses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
