-- Aprendizaje de patrones de incorporación/desincorporación de buses por línea.
-- Sirve para que el motor aprenda en qué franjas suelen activarse los buses
-- adicionales (línea 12 ejemplo: bus 3 y bus 4 entran progresivamente).

CREATE TABLE IF NOT EXISTS public.bus_line_fleet_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_code text NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  service_date date NOT NULL,
  weekday smallint NOT NULL,
  day_type text NOT NULL,
  service_slot text NOT NULL,
  active_bus_count integer NOT NULL,
  target_bus_count integer NOT NULL,
  base_bus_count integer NOT NULL,
  max_bus_count integer NOT NULL,
  activation_score numeric NOT NULL DEFAULT 0,
  avg_delay_min numeric,
  spacing_error numeric,
  cycle_time_min numeric,
  headway_min numeric,
  congestion_index numeric,
  trigger text NOT NULL DEFAULT 'tick',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS bus_line_fleet_activations_line_idx
  ON public.bus_line_fleet_activations (line_code, observed_at DESC);
CREATE INDEX IF NOT EXISTS bus_line_fleet_activations_pattern_idx
  ON public.bus_line_fleet_activations (line_code, day_type, service_slot);

GRANT SELECT ON public.bus_line_fleet_activations TO anon;
GRANT SELECT, INSERT ON public.bus_line_fleet_activations TO authenticated;
GRANT ALL ON public.bus_line_fleet_activations TO service_role;

ALTER TABLE public.bus_line_fleet_activations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read fleet activations"
  ON public.bus_line_fleet_activations
  FOR SELECT
  USING (true);

CREATE POLICY "Admins manage fleet activations"
  ON public.bus_line_fleet_activations
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));