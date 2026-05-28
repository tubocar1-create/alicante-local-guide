CREATE TABLE public.external_api_calls (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  provider text NOT NULL,
  endpoint text NOT NULL,
  model text,
  caller text NOT NULL,
  status_code integer,
  latency_ms integer,
  tokens_input integer,
  tokens_output integer,
  estimated_cost numeric(12,6),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_external_api_calls_provider_created ON public.external_api_calls (provider, created_at DESC);
CREATE INDEX idx_external_api_calls_created ON public.external_api_calls (created_at DESC);
CREATE INDEX idx_external_api_calls_caller ON public.external_api_calls (caller);

GRANT SELECT ON public.external_api_calls TO authenticated;
GRANT ALL ON public.external_api_calls TO service_role;

ALTER TABLE public.external_api_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read external_api_calls"
  ON public.external_api_calls
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Purge function: keep 30 days
CREATE OR REPLACE FUNCTION public.purge_external_api_calls(p_retention interval DEFAULT '30 days'::interval)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_rows integer := 0;
BEGIN
  DELETE FROM public.external_api_calls WHERE created_at < (now() - COALESCE(p_retention, interval '30 days'));
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;