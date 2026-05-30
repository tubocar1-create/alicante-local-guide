
INSERT INTO storage.buckets (id, name, public)
VALUES ('entity-photos', 'entity-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "entity-photos public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'entity-photos');

CREATE POLICY "entity-photos admin write"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'entity-photos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "entity-photos admin update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'entity-photos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "entity-photos admin delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'entity-photos' AND public.has_role(auth.uid(), 'admin'));
