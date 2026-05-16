ALTER TABLE public.pharmacies
  ADD COLUMN IF NOT EXISTS hours text,
  ADD COLUMN IF NOT EXISTS is_24h boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS on_duty boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_pharmacies_is_24h ON public.pharmacies (is_24h) WHERE is_24h = true;
CREATE INDEX IF NOT EXISTS idx_pharmacies_on_duty ON public.pharmacies (on_duty) WHERE on_duty = true;