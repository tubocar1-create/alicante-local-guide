-- Tabla de nombres propios reconocidos por el agente
CREATE TABLE public.agente_proper_nouns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  normalized text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  category text NOT NULL,
  route text NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  source text,
  source_id uuid,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_apn_normalized ON public.agente_proper_nouns(normalized);
CREATE INDEX idx_apn_category ON public.agente_proper_nouns(category);
CREATE UNIQUE INDEX uq_apn_norm_route ON public.agente_proper_nouns(normalized, route);

ALTER TABLE public.agente_proper_nouns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active proper nouns"
ON public.agente_proper_nouns FOR SELECT
USING (active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage proper nouns"
ON public.agente_proper_nouns FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_agente_proper_nouns_updated_at
BEFORE UPDATE ON public.agente_proper_nouns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper de normalización en SQL (mismo criterio que JS: lower + sin tildes + sin signos)
CREATE OR REPLACE FUNCTION public.agente_normalize(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(regexp_replace(
    regexp_replace(
      lower(translate(coalesce(input,''),
        'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
        'aaaaaeeeeiiiioooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC')),
      '[^a-z0-9ñ\s-]', ' ', 'g'
    ),
    '\s+', ' ', 'g'
  ));
$$;