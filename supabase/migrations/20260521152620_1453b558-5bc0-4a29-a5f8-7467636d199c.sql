
INSERT INTO public.shop_subsubsectors (subsector_id, slug, name, emoji, sort_order) VALUES
  ((SELECT id FROM public.shop_subsectors WHERE slug='moda'), 'optica', 'Ópticas', '👓', 200),
  ((SELECT id FROM public.shop_subsectors WHERE slug='moda'), 'joyeria', 'Joyerías', '💎', 210),
  ((SELECT id FROM public.shop_subsectors WHERE slug='moda'), 'lenceria', 'Lencería', '👙', 220),
  ((SELECT id FROM public.shop_subsectors WHERE slug='moda'), 'grandes-almacenes', 'Grandes almacenes', '🏬', 230),
  ((SELECT id FROM public.shop_subsectors WHERE slug='regalos'), 'juguetes', 'Juguetes', '🧸', 200),
  ((SELECT id FROM public.shop_subsectors WHERE slug='servicios-rapidos'), 'loteria', 'Loterías y apuestas', '🎰', 200),
  ((SELECT id FROM public.shop_subsectors WHERE slug='servicios-rapidos'), 'paqueteria', 'Paquetería y envíos', '📦', 210),
  ((SELECT id FROM public.shop_subsectors WHERE slug='tecnologia'), 'videojuegos', 'Videojuegos y electrónica', '🎮', 200),
  ((SELECT id FROM public.shop_subsectors WHERE slug='belleza'), 'tatuaje', 'Tatuaje y piercing', '🖋️', 200);
