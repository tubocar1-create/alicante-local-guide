
-- Motor predictivo operacional de buses Vectalia
-- Tablas de aprendizaje estadístico

-- 1) Estadísticas por segmento (parada -> parada) por línea+dirección
CREATE TABLE public.bus_segment_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  line_code TEXT NOT NULL,
  direction SMALLINT NOT NULL,
  from_stop TEXT NOT NULL,
  to_stop TEXT NOT NULL,
  distance_m NUMERIC,
  avg_minutes NUMERIC NOT NULL DEFAULT 2.0,
  rush_minutes NUMERIC,
  night_minutes NUMERIC,
  weekend_minutes NUMERIC,
  holiday_minutes NUMERIC,
  samples INTEGER NOT NULL DEFAULT 0,
  variance NUMERIC NOT NULL DEFAULT 0,
  confidence NUMERIC NOT NULL DEFAULT 0.3,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (line_code, direction, from_stop, to_stop)
);

GRANT SELECT ON public.bus_segment_stats TO anon, authenticated;
GRANT ALL ON public.bus_segment_stats TO service_role;

ALTER TABLE public.bus_segment_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read bus_segment_stats"
  ON public.bus_segment_stats FOR SELECT
  USING (true);

CREATE POLICY "Admins manage bus_segment_stats"
  ON public.bus_segment_stats FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_bus_segment_stats_line ON public.bus_segment_stats(line_code, direction);

-- 2) Estadísticas de ciclo (duración total y descanso terminal) por línea
CREATE TABLE public.bus_cycle_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  line_code TEXT NOT NULL,
  cycle_avg_min NUMERIC NOT NULL DEFAULT 60,
  cycle_morning_min NUMERIC,
  cycle_midday_min NUMERIC,
  cycle_afternoon_min NUMERIC,
  cycle_night_min NUMERIC,
  cycle_weekend_min NUMERIC,
  terminal_wait_avg_min NUMERIC NOT NULL DEFAULT 5,
  terminal_wait_min_min NUMERIC NOT NULL DEFAULT 1,
  terminal_wait_max_min NUMERIC NOT NULL DEFAULT 15,
  samples INTEGER NOT NULL DEFAULT 0,
  confidence NUMERIC NOT NULL DEFAULT 0.3,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (line_code)
);

GRANT SELECT ON public.bus_cycle_stats TO anon, authenticated;
GRANT ALL ON public.bus_cycle_stats TO service_role;

ALTER TABLE public.bus_cycle_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read bus_cycle_stats"
  ON public.bus_cycle_stats FOR SELECT
  USING (true);

CREATE POLICY "Admins manage bus_cycle_stats"
  ON public.bus_cycle_stats FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3) Snapshots manuales del operador (observación humana ocasional)
-- Distinto de bus_snapshots (que captura listas crudas de marcadores).
CREATE TABLE public.bus_operator_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  line_code TEXT NOT NULL,
  direction SMALLINT,
  stop_code TEXT NOT NULL,
  eta_minutes INTEGER,
  eta_clock TEXT,
  observed_by UUID,
  notes TEXT,
  applied BOOLEAN NOT NULL DEFAULT false,
  applied_at TIMESTAMPTZ,
  impact JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bus_operator_snapshots TO authenticated;
GRANT INSERT ON public.bus_operator_snapshots TO authenticated;
GRANT ALL ON public.bus_operator_snapshots TO service_role;

ALTER TABLE public.bus_operator_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read operator snapshots"
  ON public.bus_operator_snapshots FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert operator snapshots"
  ON public.bus_operator_snapshots FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update operator snapshots"
  ON public.bus_operator_snapshots FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_bus_operator_snapshots_line ON public.bus_operator_snapshots(line_code, observed_at DESC);
