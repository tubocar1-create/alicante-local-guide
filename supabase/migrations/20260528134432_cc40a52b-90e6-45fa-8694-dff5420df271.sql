
CREATE TABLE public.google_place_details_cache (
  place_id text PRIMARY KEY,
  details jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_place_details_cache TO authenticated;
GRANT ALL ON public.google_place_details_cache TO service_role;

ALTER TABLE public.google_place_details_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage place details cache"
ON public.google_place_details_cache
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
