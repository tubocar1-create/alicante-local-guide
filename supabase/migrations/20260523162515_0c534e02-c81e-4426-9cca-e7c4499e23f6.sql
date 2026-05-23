-- Audit columns for per-turn doctrine evaluation
ALTER TABLE public.agente_learning_log
  ADD COLUMN IF NOT EXISTS audit_phase smallint,
  ADD COLUMN IF NOT EXISTS audit_criteria jsonb,
  ADD COLUMN IF NOT EXISTS audit_verdict text,
  ADD COLUMN IF NOT EXISTS audit_note text,
  ADD COLUMN IF NOT EXISTS audited_at timestamptz,
  ADD COLUMN IF NOT EXISTS audited_by uuid;

-- Allow admins to UPDATE the log (audit needs write); reads already restricted to admins.
DROP POLICY IF EXISTS "Admins update learning log" ON public.agente_learning_log;
CREATE POLICY "Admins update learning log"
  ON public.agente_learning_log
  FOR UPDATE
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));