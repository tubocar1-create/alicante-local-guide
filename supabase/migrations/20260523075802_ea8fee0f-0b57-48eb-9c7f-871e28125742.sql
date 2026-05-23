
-- Tabla para anotaciones/correcciones manuales de eventos operacionales
CREATE TABLE public.operational_event_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL, -- referencia lógica a interaction_events.id
  flag TEXT NOT NULL DEFAULT 'ok', -- ok | incorrect_data | wrong_category | duplicate | false_positive | not_an_error
  corrected_type TEXT,
  corrected_category TEXT,
  corrected_source TEXT,
  note TEXT,
  reviewed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_op_reviews_event_id ON public.operational_event_reviews(event_id);

ALTER TABLE public.operational_event_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage operational reviews"
ON public.operational_event_reviews
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_op_reviews_updated_at
BEFORE UPDATE ON public.operational_event_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
