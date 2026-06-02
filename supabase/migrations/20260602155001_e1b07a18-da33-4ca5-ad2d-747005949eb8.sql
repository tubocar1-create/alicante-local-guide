
-- Ampliar virtual_buses con anclaje + telemetría
ALTER TABLE public.virtual_buses
  ADD COLUMN IF NOT EXISTS departure_time time,
  ADD COLUMN IF NOT EXISTS origin_terminal text,
  ADD COLUMN IF NOT EXISTS service_slot text,
  ADD COLUMN IF NOT EXISTS anchored_to_departure boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS phase_error_sec integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reliability numeric NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS last_observation_sec integer,
  ADD COLUMN IF NOT EXISTS speed_kmh numeric,
  ADD COLUMN IF NOT EXISTS safe_mode boolean NOT NULL DEFAULT false;

-- bus_engine_health
CREATE TABLE IF NOT EXISTS public.bus_engine_health (
  line_code text PRIMARY KEY,
  last_tick_at timestamptz NOT NULL DEFAULT now(),
  last_tick_sec integer NOT NULL DEFAULT 0,
  engine_alive boolean NOT NULL DEFAULT true,
  prediction_quality text NOT NULL DEFAULT 'medium',
  active_buses integer NOT NULL DEFAULT 0,
  fleet_size_expected integer NOT NULL DEFAULT 0,
  avg_confidence numeric NOT NULL DEFAULT 0.5,
  safe_mode boolean NOT NULL DEFAULT false,
  learning_active boolean NOT NULL DEFAULT true,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bus_engine_health TO anon, authenticated;
GRANT ALL ON public.bus_engine_health TO service_role;

ALTER TABLE public.bus_engine_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read engine health"
  ON public.bus_engine_health FOR SELECT
  USING (true);

CREATE POLICY "Admins manage engine health"
  ON public.bus_engine_health FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- bus_segment_stats_slot
CREATE TABLE IF NOT EXISTS public.bus_segment_stats_slot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_code text NOT NULL,
  direction smallint NOT NULL,
  from_stop text NOT NULL,
  to_stop text NOT NULL,
  day_type text NOT NULL DEFAULT 'laborable',
  service_slot text NOT NULL,
  avg_minutes numeric NOT NULL DEFAULT 2.0,
  samples integer NOT NULL DEFAULT 0,
  confidence numeric NOT NULL DEFAULT 0.3,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (line_code, direction, from_stop, to_stop, day_type, service_slot)
);

GRANT SELECT ON public.bus_segment_stats_slot TO anon, authenticated;
GRANT ALL ON public.bus_segment_stats_slot TO service_role;

ALTER TABLE public.bus_segment_stats_slot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read segment slot stats"
  ON public.bus_segment_stats_slot FOR SELECT
  USING (true);

CREATE POLICY "Admins manage segment slot stats"
  ON public.bus_segment_stats_slot FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
