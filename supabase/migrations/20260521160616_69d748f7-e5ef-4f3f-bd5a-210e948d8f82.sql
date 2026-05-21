INSERT INTO public.shop_subsubsectors (id, subsector_id, slug, name, emoji, sort_order, active)
VALUES ('a1b2c3d4-0001-4000-8000-000000000005', '7078c41e-8815-41d2-9b2f-714b545848c2', 'talleres-mecanicos', 'Talleres mecánicos', '🔧', 20, true)
ON CONFLICT (id) DO NOTHING;