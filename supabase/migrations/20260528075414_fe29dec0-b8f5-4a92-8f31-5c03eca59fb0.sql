
-- 1) test_users: drop overly permissive public policies
DROP POLICY IF EXISTS "Public read test_users" ON public.test_users;
DROP POLICY IF EXISTS "Public insert test_users" ON public.test_users;

-- Keep table accessible for admin tooling only (admin uses service role which bypasses RLS).
CREATE POLICY "Admins read test_users"
  ON public.test_users FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage test_users"
  ON public.test_users FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2) shop-photos storage bucket: admin-only writes, public reads
CREATE POLICY "Public read shop-photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'shop-photos');

CREATE POLICY "Admins write shop-photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'shop-photos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update shop-photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'shop-photos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete shop-photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'shop-photos' AND has_role(auth.uid(), 'admin'::app_role));
