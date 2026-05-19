
CREATE TABLE public.agente_faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keywords text[] NOT NULL DEFAULT '{}',
  any_of text[] NOT NULL DEFAULT '{}',
  response text NOT NULL,
  route text,
  priority integer NOT NULL DEFAULT 100,
  hits integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agente_faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active faqs" ON public.agente_faqs
  FOR SELECT USING (active = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage faqs" ON public.agente_faqs
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_agente_faqs_updated
  BEFORE UPDATE ON public.agente_faqs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_agente_faqs_priority ON public.agente_faqs (priority) WHERE active = true;

CREATE TABLE public.agente_unknown_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  normalized text NOT NULL,
  path text,
  count integer NOT NULL DEFAULT 1,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_agente_unknown_normalized ON public.agente_unknown_queries (normalized);

ALTER TABLE public.agente_unknown_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read unknown queries" ON public.agente_unknown_queries
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));
