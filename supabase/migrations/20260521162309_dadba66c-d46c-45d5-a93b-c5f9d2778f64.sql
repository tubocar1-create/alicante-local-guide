INSERT INTO public.shop_subsubsectors (id, subsector_id, slug, name, emoji, sort_order, active)
VALUES ('b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'eee548ef-560f-4de8-9136-9768408e43d7', 'pescaderias', 'Pescaderías', '🐟', 100, true)
ON CONFLICT (id) DO NOTHING;