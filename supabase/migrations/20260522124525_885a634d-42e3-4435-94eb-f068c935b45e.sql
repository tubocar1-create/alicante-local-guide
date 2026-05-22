
ALTER TABLE public.agente_unknown_queries
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_assigned_intent text,
  ADD COLUMN IF NOT EXISTS auto_added_keywords text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS confidence numeric;

CREATE INDEX IF NOT EXISTS idx_agente_unknown_unprocessed
  ON public.agente_unknown_queries (count DESC, last_seen_at DESC)
  WHERE processed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.agente_learning_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  unknown_query_id uuid REFERENCES public.agente_unknown_queries(id) ON DELETE SET NULL,
  raw_query text NOT NULL,
  normalized text NOT NULL,
  intent_key text,
  added_keywords text[] NOT NULL DEFAULT '{}',
  confidence numeric,
  decision text NOT NULL,
  model text,
  notes text
);

ALTER TABLE public.agente_learning_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read learning log"
  ON public.agente_learning_log
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
