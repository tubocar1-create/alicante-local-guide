
-- 1. Tabla con emails permitidos como admin
CREATE TABLE IF NOT EXISTS public.admin_allowed_emails (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_allowed_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view allowed emails" ON public.admin_allowed_emails;
CREATE POLICY "Admins can view allowed emails"
ON public.admin_allowed_emails
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage allowed emails" ON public.admin_allowed_emails;
CREATE POLICY "Admins can manage allowed emails"
ON public.admin_allowed_emails
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.admin_allowed_emails (email) VALUES
  ('tubocar1@gmail.com'),
  ('plastiahorro@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- 2. Trigger: al crearse un usuario en auth.users, si su email está permitido -> admin
CREATE OR REPLACE FUNCTION public.assign_admin_role_if_allowed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.admin_allowed_emails WHERE lower(email) = lower(NEW.email)
  ) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_assign_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_admin
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.assign_admin_role_if_allowed();

-- 3. Backfill: usuarios existentes con esos emails -> admin
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u
JOIN public.admin_allowed_emails a ON lower(a.email) = lower(u.email)
ON CONFLICT (user_id, role) DO NOTHING;
