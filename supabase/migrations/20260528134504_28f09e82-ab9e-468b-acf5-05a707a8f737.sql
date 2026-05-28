
ALTER TABLE public.google_place_details_cache
  ADD COLUMN IF NOT EXISTS cache_key text UNIQUE;
