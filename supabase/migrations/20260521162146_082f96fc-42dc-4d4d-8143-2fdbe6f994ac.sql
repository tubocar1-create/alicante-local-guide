INSERT INTO public.shop_subsubsectors (id, subsector_id, slug, name, emoji, sort_order, active)
VALUES ('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'eee548ef-560f-4de8-9136-9768408e43d7', 'fruterias', 'Fruterías', '🍎', 100, true)
ON CONFLICT (id) DO NOTHING;