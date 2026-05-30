DELETE FROM public.beach_covers WHERE slug NOT IN ('postiguet', 'san-juan');

UPDATE public.beach_covers
SET photos = ARRAY[
  'https://htzatsqihojttrwsawis.supabase.co/storage/v1/object/public/beach-photos/library/postiguet1.jpg',
  'https://htzatsqihojttrwsawis.supabase.co/storage/v1/object/public/beach-photos/library/postiguet2.jpg',
  'https://htzatsqihojttrwsawis.supabase.co/storage/v1/object/public/beach-photos/library/postiguet5.jpg'
],
public_url = 'https://htzatsqihojttrwsawis.supabase.co/storage/v1/object/public/beach-photos/library/postiguet1.jpg',
updated_at = now()
WHERE slug = 'postiguet';

UPDATE public.beach_covers
SET photos = ARRAY['https://htzatsqihojttrwsawis.supabase.co/storage/v1/object/public/beach-photos/library/sanjuan6.jpg'],
public_url = 'https://htzatsqihojttrwsawis.supabase.co/storage/v1/object/public/beach-photos/library/sanjuan6.jpg',
updated_at = now()
WHERE slug = 'san-juan';