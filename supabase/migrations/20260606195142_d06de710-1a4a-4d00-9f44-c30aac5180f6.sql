CREATE TABLE public.viator_tours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  price_text text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.viator_tours TO anon, authenticated;
GRANT ALL ON public.viator_tours TO service_role;

ALTER TABLE public.viator_tours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Viator tours readable by everyone"
  ON public.viator_tours FOR SELECT
  USING (true);

CREATE TRIGGER trg_viator_tours_updated_at
  BEFORE UPDATE ON public.viator_tours
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();