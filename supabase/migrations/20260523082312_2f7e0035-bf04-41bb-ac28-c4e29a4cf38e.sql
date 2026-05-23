ALTER TABLE public.agente_learning_log
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS review_status text;

CREATE INDEX IF NOT EXISTS idx_agente_learning_log_dubious
  ON public.agente_learning_log (created_at DESC)
  WHERE resolved IS NOT TRUE OR fallback_used IS TRUE;