CREATE TABLE public.agente_llm_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  normalized text NOT NULL,
  path text NOT NULL DEFAULT '/',
  raw_query text NOT NULL,
  reply text NOT NULL,
  navigate text,
  forward_prompt text,
  model text,
  hits integer NOT NULL DEFAULT 1,
  last_used_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  CONSTRAINT agente_llm_cache_unique UNIQUE (normalized, path)
);

CREATE INDEX idx_agente_llm_cache_lookup ON public.agente_llm_cache (normalized, path) WHERE active = true;
CREATE INDEX idx_agente_llm_cache_hits ON public.agente_llm_cache (hits DESC);

GRANT ALL ON public.agente_llm_cache TO service_role;

ALTER TABLE public.agente_llm_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read llm cache"
ON public.agente_llm_cache
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage llm cache"
ON public.agente_llm_cache
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_agente_llm_cache_updated_at
BEFORE UPDATE ON public.agente_llm_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();