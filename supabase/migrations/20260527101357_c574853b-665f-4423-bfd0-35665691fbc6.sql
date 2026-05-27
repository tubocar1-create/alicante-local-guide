-- Limpieza de posibles duplicados existentes antes de crear el índice único.
DELETE FROM public.agente_proper_nouns a
USING public.agente_proper_nouns b
WHERE a.ctid < b.ctid
  AND a.normalized = b.normalized
  AND a.route = b.route;

CREATE UNIQUE INDEX IF NOT EXISTS agente_proper_nouns_normalized_route_uidx
  ON public.agente_proper_nouns (normalized, route);