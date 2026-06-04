CREATE TABLE public.bus_line_shapes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_code text NOT NULL,
  direction smallint NOT NULL,
  source text NOT NULL DEFAULT 'vectalia_kmz',
  source_line_id text,
  geometry jsonb NOT NULL,
  total_length_m numeric NOT NULL,
  point_count integer NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(line_code, direction)
);

GRANT SELECT ON public.bus_line_shapes TO anon, authenticated;
GRANT ALL ON public.bus_line_shapes TO service_role;

ALTER TABLE public.bus_line_shapes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bus line shapes are publicly readable"
  ON public.bus_line_shapes FOR SELECT
  USING (true);

CREATE TRIGGER update_bus_line_shapes_updated_at
  BEFORE UPDATE ON public.bus_line_shapes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.bus_line_stop_distances (
  line_code text NOT NULL,
  direction smallint NOT NULL,
  from_seq integer NOT NULL,
  to_seq integer NOT NULL,
  from_stop_code text,
  to_stop_code text,
  distance_m numeric NOT NULL,
  cumulative_m numeric NOT NULL,
  snap_offset_from_m numeric,
  snap_offset_to_m numeric,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (line_code, direction, from_seq)
);

CREATE INDEX bus_line_stop_distances_lookup_idx
  ON public.bus_line_stop_distances(line_code, direction);

GRANT SELECT ON public.bus_line_stop_distances TO anon, authenticated;
GRANT ALL ON public.bus_line_stop_distances TO service_role;

ALTER TABLE public.bus_line_stop_distances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bus line stop distances are publicly readable"
  ON public.bus_line_stop_distances FOR SELECT
  USING (true);