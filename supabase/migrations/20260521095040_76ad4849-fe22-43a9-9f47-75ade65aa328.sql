
-- Sectores
CREATE TABLE public.shop_sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  short_label text,
  emoji text,
  sort_order int NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.shop_subsectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL REFERENCES public.shop_sectors(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  emoji text,
  sort_order int NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sector_id, slug)
);

CREATE TABLE public.shop_subsubsectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subsector_id uuid NOT NULL REFERENCES public.shop_subsectors(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  emoji text,
  sort_order int NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subsector_id, slug)
);

CREATE TABLE public.shop_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subsubsector_id uuid NOT NULL REFERENCES public.shop_subsubsectors(id) ON DELETE CASCADE,
  label text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  verbal_recommendation text,
  priority int NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  hits int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shop_subsectors_sector_idx ON public.shop_subsectors(sector_id);
CREATE INDEX shop_subsubsectors_subsector_idx ON public.shop_subsubsectors(subsector_id);
CREATE INDEX shop_intents_subsubsector_idx ON public.shop_intents(subsubsector_id);

-- Aprendizaje: cada consulta del usuario se registra
CREATE TABLE public.shop_intent_learning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_query text NOT NULL,
  normalized_query text NOT NULL,
  matched_sector_id uuid REFERENCES public.shop_sectors(id) ON DELETE SET NULL,
  matched_subsector_id uuid REFERENCES public.shop_subsectors(id) ON DELETE SET NULL,
  matched_subsubsector_id uuid REFERENCES public.shop_subsubsectors(id) ON DELETE SET NULL,
  matched_intent_id uuid REFERENCES public.shop_intents(id) ON DELETE SET NULL,
  confidence numeric,
  ai_suggested_keywords text[] NOT NULL DEFAULT '{}',
  ai_response text,
  needs_review boolean NOT NULL DEFAULT false,
  resolved boolean NOT NULL DEFAULT false,
  hits int NOT NULL DEFAULT 1,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shop_intent_learning_normalized_idx ON public.shop_intent_learning(normalized_query);
CREATE INDEX shop_intent_learning_review_idx ON public.shop_intent_learning(needs_review) WHERE needs_review = true;

-- updated_at triggers
CREATE TRIGGER trg_shop_sectors_updated BEFORE UPDATE ON public.shop_sectors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_shop_subsectors_updated BEFORE UPDATE ON public.shop_subsectors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_shop_subsubsectors_updated BEFORE UPDATE ON public.shop_subsubsectors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_shop_intents_updated BEFORE UPDATE ON public.shop_intents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.shop_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_subsectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_subsubsectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_intent_learning ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read shop_sectors" ON public.shop_sectors FOR SELECT USING (active = true OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage shop_sectors" ON public.shop_sectors FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public read shop_subsectors" ON public.shop_subsectors FOR SELECT USING (active = true OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage shop_subsectors" ON public.shop_subsectors FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public read shop_subsubsectors" ON public.shop_subsubsectors FOR SELECT USING (active = true OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage shop_subsubsectors" ON public.shop_subsubsectors FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public read shop_intents" ON public.shop_intents FOR SELECT USING (active = true OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage shop_intents" ON public.shop_intents FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins read learning" ON public.shop_intent_learning FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage learning" ON public.shop_intent_learning FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
-- Insertions happen server-side via service role; no anon insert policy.
