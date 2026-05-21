INSERT INTO public.shop_subsubsectors (id, subsector_id, slug, name, emoji, sort_order, active)
VALUES ('d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a', '5e7074f1-c722-4fc9-9daf-329c00207178', 'jugueterias', 'Jugueterías', '🧸', 100, true)
ON CONFLICT (id) DO NOTHING;