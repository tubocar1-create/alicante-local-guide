
-- Fase 5: tabla de eventos de snapshot normalizados + estadísticas adicionales

CREATE TABLE public.bus_snapshot_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_snapshot_id uuid REFERENCES public.bus_operator_snapshots(id) ON DELETE SET NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  line_code text NOT NULL,
  direction smallint,
  stop_code text NOT NULL,
  observed_eta_minutes integer,
  observed_clock_time text,
  inferred_bus_id text,
  inferred_trip_id text,
  inferred_departure_min integer,
  predicted_eta_minutes integer,
  delta_minutes numeric,
  segment_from_stop text,
  segment_to_stop text,
  confidence numeric NOT NULL DEFAULT 0.5,
  snapshot_source text NOT NULL DEFAULT 'manual',
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  impact jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bus_snapshot_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bus_snapshot_events TO authenticated;
GRANT ALL ON public.bus_snapshot_events TO service_role;

ALTER TABLE public.bus_snapshot_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read bus_snapshot_events"
  ON public.bus_snapshot_events FOR SELECT USING (true);
CREATE POLICY "Admins write bus_snapshot_events"
  ON public.bus_snapshot_events FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_bus_snapshot_events_line ON public.bus_snapshot_events(line_code, observed_at DESC);
CREATE INDEX idx_bus_snapshot_events_unprocessed ON public.bus_snapshot_events(processed) WHERE processed = false;

-- Headway (intervalo entre salidas) por franja horaria
CREATE TABLE public.bus_headway_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_code text NOT NULL,
  direction smallint NOT NULL,
  hour_bucket smallint NOT NULL,
  day_type text NOT NULL DEFAULT 'laborable',
  headway_avg_min numeric NOT NULL DEFAULT 15,
  headway_min numeric,
  headway_max numeric,
  active_bus_count integer NOT NULL DEFAULT 1,
  samples integer NOT NULL DEFAULT 0,
  confidence numeric NOT NULL DEFAULT 0.3,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(line_code, direction, hour_bucket, day_type)
);

GRANT SELECT ON public.bus_headway_stats TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bus_headway_stats TO authenticated;
GRANT ALL ON public.bus_headway_stats TO service_role;
ALTER TABLE public.bus_headway_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read bus_headway_stats" ON public.bus_headway_stats FOR SELECT USING (true);
CREATE POLICY "Admins write bus_headway_stats" ON public.bus_headway_stats FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Reposo en terminal por línea/dirección/franja
CREATE TABLE public.bus_terminal_rest_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_code text NOT NULL,
  direction smallint NOT NULL,
  terminal_stop_code text NOT NULL,
  hour_bucket smallint,
  rest_avg_min numeric NOT NULL DEFAULT 5,
  rest_min_min numeric NOT NULL DEFAULT 1,
  rest_max_min numeric NOT NULL DEFAULT 15,
  samples integer NOT NULL DEFAULT 0,
  confidence numeric NOT NULL DEFAULT 0.3,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(line_code, direction, terminal_stop_code, hour_bucket)
);

GRANT SELECT ON public.bus_terminal_rest_stats TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bus_terminal_rest_stats TO authenticated;
GRANT ALL ON public.bus_terminal_rest_stats TO service_role;
ALTER TABLE public.bus_terminal_rest_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read bus_terminal_rest_stats" ON public.bus_terminal_rest_stats FOR SELECT USING (true);
CREATE POLICY "Admins write bus_terminal_rest_stats" ON public.bus_terminal_rest_stats FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Dwell time por parada
CREATE TABLE public.bus_dwell_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_code text NOT NULL,
  direction smallint NOT NULL,
  stop_code text NOT NULL,
  hour_bucket smallint,
  dwell_avg_sec numeric NOT NULL DEFAULT 20,
  samples integer NOT NULL DEFAULT 0,
  confidence numeric NOT NULL DEFAULT 0.3,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(line_code, direction, stop_code, hour_bucket)
);

GRANT SELECT ON public.bus_dwell_stats TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bus_dwell_stats TO authenticated;
GRANT ALL ON public.bus_dwell_stats TO service_role;
ALTER TABLE public.bus_dwell_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read bus_dwell_stats" ON public.bus_dwell_stats FOR SELECT USING (true);
CREATE POLICY "Admins write bus_dwell_stats" ON public.bus_dwell_stats FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Añadir freshness a stats existentes
ALTER TABLE public.bus_segment_stats ADD COLUMN IF NOT EXISTS last_snapshot_at timestamptz;
ALTER TABLE public.bus_cycle_stats ADD COLUMN IF NOT EXISTS last_snapshot_at timestamptz;

CREATE TRIGGER trg_bus_snapshot_events_updated
  BEFORE UPDATE ON public.bus_snapshot_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
