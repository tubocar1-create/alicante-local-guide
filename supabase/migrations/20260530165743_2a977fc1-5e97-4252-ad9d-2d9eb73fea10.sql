-- Add cover_photo column to places and backfill from cached storage photos.
ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS cover_photo text;

CREATE INDEX IF NOT EXISTS idx_places_cover_photo_null
  ON public.places (google_place_id)
  WHERE cover_photo IS NULL;

-- Backfill from shop-photos bucket. Prefer prefix "places/" (w800),
-- fall back to "gphotos/places/" (w1600/w1200/w600). Pick the first
-- photo_dir alphabetically per google_place_id to ensure stability.
WITH ranked AS (
  SELECT
    split_part(name, '/', 2) AS gpid_places,
    NULL::text AS gpid_gphotos,
    name,
    1 AS prio
  FROM storage.objects
  WHERE bucket_id = 'shop-photos'
    AND name LIKE 'places/%/photos/%/w%.jpg'
  UNION ALL
  SELECT
    NULL::text,
    split_part(name, '/', 3) AS gpid_gphotos,
    name,
    2
  FROM storage.objects
  WHERE bucket_id = 'shop-photos'
    AND name LIKE 'gphotos/places/%/photos/%/w%.jpg'
),
unified AS (
  SELECT COALESCE(gpid_places, gpid_gphotos) AS gpid, name, prio
  FROM ranked
),
picked AS (
  SELECT DISTINCT ON (gpid)
    gpid,
    'https://htzatsqihojttrwsawis.supabase.co/storage/v1/object/public/shop-photos/' || name AS url
  FROM unified
  ORDER BY gpid, prio, name
)
UPDATE public.places p
SET cover_photo = picked.url
FROM picked
WHERE p.google_place_id = picked.gpid
  AND p.cover_photo IS NULL;
