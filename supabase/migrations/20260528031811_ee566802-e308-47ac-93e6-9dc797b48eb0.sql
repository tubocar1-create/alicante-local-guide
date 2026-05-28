
ALTER TABLE public.health_centers
  ADD COLUMN IF NOT EXISTS google_place_id text,
  ADD COLUMN IF NOT EXISTS google_photo_refs text[] NOT NULL DEFAULT '{}'::text[];
