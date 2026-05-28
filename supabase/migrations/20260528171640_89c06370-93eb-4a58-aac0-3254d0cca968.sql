CREATE TABLE IF NOT EXISTS public.system_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE ON public.system_flags TO authenticated;
GRANT ALL ON public.system_flags TO service_role;

ALTER TABLE public.system_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read flags" ON public.system_flags
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins update flags" ON public.system_flags
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins insert flags" ON public.system_flags
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.system_flags (key, enabled)
VALUES ('google_api_enabled', false)
ON CONFLICT (key) DO NOTHING;