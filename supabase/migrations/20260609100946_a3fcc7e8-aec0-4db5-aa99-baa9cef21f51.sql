CREATE TABLE IF NOT EXISTS public.bus_stop_catalog (
  stop_id text PRIMARY KEY,
  stop_name text NOT NULL,
  page_number integer NOT NULL,
  source_url text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bus_stop_catalog TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.bus_stop_catalog TO anon;
GRANT ALL ON public.bus_stop_catalog TO service_role;

ALTER TABLE public.bus_stop_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bus_stop_catalog read all"
  ON public.bus_stop_catalog FOR SELECT
  USING (true);

CREATE POLICY "bus_stop_catalog write anon-authenticated"
  ON public.bus_stop_catalog FOR INSERT
  WITH CHECK (true);

CREATE POLICY "bus_stop_catalog update anon-authenticated"
  ON public.bus_stop_catalog FOR UPDATE
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS bus_stop_catalog_page_idx ON public.bus_stop_catalog(page_number);