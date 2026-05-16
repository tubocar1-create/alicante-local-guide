CREATE TABLE public.pharmacies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  name text NOT NULL,
  address text,
  postal_code text,
  city text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pharmacies publicly readable" ON public.pharmacies FOR SELECT USING (true);
CREATE INDEX idx_pharmacies_postal_code ON public.pharmacies(postal_code);