CREATE TABLE IF NOT EXISTS public.bus_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line text NOT NULL,
  stop_code text NOT NULL,
  buses_count integer NOT NULL DEFAULT 0,
  raw_markers jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_url text,
  notes text,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bus_snapshots_line_captured_idx
  ON public.bus_snapshots (line, captured_at DESC);

GRANT SELECT, INSERT ON public.bus_snapshots TO authenticated;
GRANT ALL ON public.bus_snapshots TO service_role;

ALTER TABLE public.bus_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read snapshots" ON public.bus_snapshots
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth insert snapshots" ON public.bus_snapshots
  FOR INSERT TO authenticated WITH CHECK (true);