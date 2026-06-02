
-- Phase 1: Virtual buses table + segment stats extension

CREATE TABLE IF NOT EXISTS public.virtual_buses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_code text NOT NULL,
  direction smallint NOT NULL,
  trip_key text NOT NULL,
  service_date date NOT NULL,
  current_segment_idx integer,
  segment_progress numeric,
  distance_from_origin_m numeric,
  speed_kmh numeric,
  state text NOT NULL DEFAULT 'estimated',
  source text NOT NULL DEFAULT 'inferred',
  headway_slot text,
  confidence numeric NOT NULL DEFAULT 0.3,
  last_tick_at timestamptz,
  last_observation_at timestamptz,
  estimated_terminal_arrival timestamptz,
  estimated_cycle_completion timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  position_lat double precision,
  position_lng double precision,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT virtual_buses_unique_trip UNIQUE (line_code, direction, trip_key, service_date)
);

CREATE INDEX IF NOT EXISTS idx_virtual_buses_line_active
  ON public.virtual_buses (line_code, is_active);
CREATE INDEX IF NOT EXISTS idx_virtual_buses_service_date
  ON public.virtual_buses (service_date);

GRANT SELECT ON public.virtual_buses TO anon;
GRANT SELECT ON public.virtual_buses TO authenticated;
GRANT ALL ON public.virtual_buses TO service_role;

ALTER TABLE public.virtual_buses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read virtual_buses"
  ON public.virtual_buses
  FOR SELECT
  USING (true);

CREATE POLICY "Admins manage virtual_buses"
  ON public.virtual_buses
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_virtual_buses_updated_at
  BEFORE UPDATE ON public.virtual_buses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Extender bus_segment_stats con ventana horaria + factor pico
ALTER TABLE public.bus_segment_stats
  ADD COLUMN IF NOT EXISTS time_window text,
  ADD COLUMN IF NOT EXISTS peak_factor numeric;
