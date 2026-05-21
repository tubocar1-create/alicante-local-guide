INSERT INTO public.shop_subsubsectors (id, subsector_id, slug, name, emoji, sort_order, active)
VALUES ('c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', '5e7074f1-c722-4fc9-9daf-329c00207178', 'sex-shops', 'Sex Shops', '🔞', 200, true)
ON CONFLICT (id) DO NOTHING;