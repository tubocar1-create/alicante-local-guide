CREATE TABLE IF NOT EXISTS public.bus_realtime_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_code text NOT NULL,
  line_code text NOT NULL,
  direction smallint,
  eta_minutes integer[] NOT NULL DEFAULT '{}',
  source text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bus_realtime_snapshots_stop_line_unique UNIQUE (stop_code, line_code)
);

CREATE INDEX IF NOT EXISTS idx_bus_realtime_snapshots_line_captured
  ON public.bus_realtime_snapshots (line_code, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_bus_realtime_snapshots_stop_captured
  ON public.bus_realtime_snapshots (stop_code, captured_at DESC);

GRANT SELECT ON public.bus_realtime_snapshots TO anon, authenticated;
GRANT ALL ON public.bus_realtime_snapshots TO service_role;

ALTER TABLE public.bus_realtime_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bus realtime snapshots publicly readable"
  ON public.bus_realtime_snapshots FOR SELECT
  USING (true);