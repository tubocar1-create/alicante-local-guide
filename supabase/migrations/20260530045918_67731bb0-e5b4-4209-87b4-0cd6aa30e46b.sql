
ALTER TABLE public.hotels_static
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS scraped_photos text[],
  ADD COLUMN IF NOT EXISTS photo_scrape_status text,
  ADD COLUMN IF NOT EXISTS photo_scrape_at timestamptz;

UPDATE public.hotels_static
SET website = raw->>'websiteUri'
WHERE website IS NULL AND raw ? 'websiteUri';

CREATE INDEX IF NOT EXISTS idx_hotels_static_scrape_pending
  ON public.hotels_static (photo_scrape_status)
  WHERE website IS NOT NULL AND photo_scrape_status IS NULL;
