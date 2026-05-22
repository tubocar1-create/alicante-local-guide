
-- Tabla de supervisiones pendientes / realizadas por el administrador
-- sobre las decisiones de auto-aprendizaje del agente.
CREATE TABLE public.agente_admin_supervisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Origen de la supervisión
  source text NOT NULL DEFAULT 'auto_learning', -- auto_learning | unknown_query | manual
  unknown_query_id uuid REFERENCES public.agente_unknown_queries(id) ON DELETE SET NULL,
  learning_log_id uuid REFERENCES public.agente_learning_log(id) ON DELETE SET NULL,

  -- Contenido a revisar
  raw_query text NOT NULL,
  normalized text NOT NULL,
  suggested_intent text,                 -- intent propuesto por la IA
  suggested_keywords text[] NOT NULL DEFAULT '{}',
  confidence numeric,
  model text,

  -- Estado de la supervisión
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected | edited | ignored
  priority int NOT NULL DEFAULT 100,
  reason text,                            -- por qué quedó pendiente (low_confidence, invalid_domain, etc.)

  -- Acción final del admin
  final_intent text,
  final_keywords text[] NOT NULL DEFAULT '{}',
  admin_notes text,
  reviewed_by uuid,                       -- auth.uid() del admin
  reviewed_at timestamptz
);

CREATE INDEX idx_agente_admin_sup_status
  ON public.agente_admin_supervisions (status, priority DESC, created_at DESC);

CREATE INDEX idx_agente_admin_sup_unknown
  ON public.agente_admin_supervisions (unknown_query_id);

ALTER TABLE public.agente_admin_supervisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read supervisions"
  ON public.agente_admin_supervisions
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage supervisions"
  ON public.agente_admin_supervisions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_agente_admin_sup_updated
  BEFORE UPDATE ON public.agente_admin_supervisions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
