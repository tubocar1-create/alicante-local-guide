ALTER TABLE public.places_cache ADD COLUMN IF NOT EXISTS ai_tags text[];
CREATE INDEX IF NOT EXISTS places_cache_ai_tags_gin_idx ON public.places_cache USING gin (ai_tags);