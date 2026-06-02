
CREATE TABLE public.bus_fleet_observations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  line_code text NOT NULL,
  direction smallint NOT NULL,
  stop_code text NOT NULL,
  observed_eta_min numeric NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'preview_real',
  client_id text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.bus_fleet_observations TO anon;
GRANT SELECT, INSERT ON public.bus_fleet_observations TO authenticated;
GRANT ALL ON public.bus_fleet_observations TO service_role;

ALTER TABLE public.bus_fleet_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read fleet observations"
  ON public.bus_fleet_observations FOR SELECT USING (true);

CREATE POLICY "Anyone can insert fleet observations"
  ON public.bus_fleet_observations FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins manage fleet observations"
  ON public.bus_fleet_observations FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_bus_fleet_obs_line_stop_time
  ON public.bus_fleet_observations (line_code, stop_code, observed_at DESC);

CREATE INDEX idx_bus_fleet_obs_observed_at
  ON public.bus_fleet_observations (observed_at DESC);

-- Purga: retenemos 7 días de observaciones (suficiente para WMWA semanal)
CREATE OR REPLACE FUNCTION public.purge_bus_fleet_observations(p_retention interval DEFAULT '7 days')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows integer := 0;
BEGIN
  DELETE FROM public.bus_fleet_observations
  WHERE observed_at < (now() - COALESCE(p_retention, interval '7 days'));
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END; $$;
