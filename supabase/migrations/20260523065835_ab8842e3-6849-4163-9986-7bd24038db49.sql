
-- Extend agente_learning_log with telemetry columns (all nullable, safe defaults)
ALTER TABLE public.agente_learning_log
  ADD COLUMN IF NOT EXISTS normalized_query text,
  ADD COLUMN IF NOT EXISTS detected_intent text,
  ADD COLUMN IF NOT EXISTS intent_confidence numeric,
  ADD COLUMN IF NOT EXISTS resolver_type text,
  ADD COLUMN IF NOT EXISTS resolved boolean,
  ADD COLUMN IF NOT EXISTS fallback_used boolean,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS latency_ms integer,
  ADD COLUMN IF NOT EXISTS model_used text,
  ADD COLUMN IF NOT EXISTS tokens_input integer,
  ADD COLUMN IF NOT EXISTS tokens_output integer,
  ADD COLUMN IF NOT EXISTS estimated_cost numeric,
  ADD COLUMN IF NOT EXISTS clicked_result text,
  ADD COLUMN IF NOT EXISTS conversion_event text,
  ADD COLUMN IF NOT EXISTS route_origin text,
  ADD COLUMN IF NOT EXISTS geo_context jsonb,
  ADD COLUMN IF NOT EXISTS session_id text;

CREATE INDEX IF NOT EXISTS idx_agente_learning_log_created_at ON public.agente_learning_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agente_learning_log_failure_reason ON public.agente_learning_log (failure_reason);
CREATE INDEX IF NOT EXISTS idx_agente_learning_log_detected_intent ON public.agente_learning_log (detected_intent);
CREATE INDEX IF NOT EXISTS idx_agente_learning_log_session_id ON public.agente_learning_log (session_id);

-- Track manual actions performed on unknown queries from the admin panel
CREATE TABLE IF NOT EXISTS public.agente_unknown_query_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unknown_query_id uuid REFERENCES public.agente_unknown_queries(id) ON DELETE CASCADE,
  action text NOT NULL,                 -- promoted_intent | added_faq | added_alias | spam | ignored | merged | sent_to_supervision
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  performed_by uuid,
  performed_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

CREATE INDEX IF NOT EXISTS idx_agente_unknown_query_actions_q ON public.agente_unknown_query_actions (unknown_query_id);
CREATE INDEX IF NOT EXISTS idx_agente_unknown_query_actions_action ON public.agente_unknown_query_actions (action);

ALTER TABLE public.agente_unknown_query_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage unknown query actions"
  ON public.agente_unknown_query_actions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
