ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS scraped_photos text[],
  ADD COLUMN IF NOT EXISTS photo_scrape_status text,
  ADD COLUMN IF NOT EXISTS photo_scrape_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_places_photo_scrape_status
  ON public.places (photo_scrape_status);

ALTER TABLE public.shop_businesses
  ADD COLUMN IF NOT EXISTS photo_scrape_status text,
  ADD COLUMN IF NOT EXISTS photo_scrape_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_shop_businesses_photo_scrape_status
  ON public.shop_businesses (photo_scrape_status);