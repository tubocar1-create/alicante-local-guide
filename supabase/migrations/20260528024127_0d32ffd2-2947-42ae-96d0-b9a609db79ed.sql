CREATE TABLE public.ad_variants_cache (
  advertiser_id text NOT NULL,
  day_madrid date NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (advertiser_id, day_madrid)
);

GRANT SELECT ON public.ad_variants_cache TO anon, authenticated;
GRANT ALL ON public.ad_variants_cache TO service_role;

ALTER TABLE public.ad_variants_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ad variants cache"
ON public.ad_variants_cache FOR SELECT
USING (true);

CREATE OR REPLACE FUNCTION public.purge_ad_variants_cache(p_retention interval DEFAULT '7 days'::interval)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_rows integer := 0;
BEGIN
  DELETE FROM public.ad_variants_cache WHERE day_madrid < (current_date - COALESCE(p_retention, interval '7 days'));
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$function$;