
CREATE TABLE IF NOT EXISTS public.test_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  surname text,
  email text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.test_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read test_users" ON public.test_users;
DROP POLICY IF EXISTS "Public insert test_users" ON public.test_users;

CREATE POLICY "Public read test_users"
ON public.test_users
FOR SELECT
USING (true);

CREATE POLICY "Public insert test_users"
ON public.test_users
FOR INSERT
WITH CHECK (true);
