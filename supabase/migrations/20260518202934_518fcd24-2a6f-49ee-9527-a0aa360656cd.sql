
ALTER TABLE public.hotels_static ADD COLUMN IF NOT EXISTS liteapi_id TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_hotels_static_liteapi_id ON public.hotels_static (liteapi_id);
