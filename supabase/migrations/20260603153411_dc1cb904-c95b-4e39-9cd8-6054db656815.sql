CREATE TABLE public.firecrawl_call_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose text NOT NULL DEFAULT 'favorite_stop',
  stop_id text,
  line text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_firecrawl_call_log_user_created ON public.firecrawl_call_log (user_id, created_at DESC);

GRANT SELECT ON public.firecrawl_call_log TO authenticated;
GRANT ALL ON public.firecrawl_call_log TO service_role;

ALTER TABLE public.firecrawl_call_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read their own firecrawl calls"
ON public.firecrawl_call_log FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "admins can read all firecrawl calls"
ON public.firecrawl_call_log FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));