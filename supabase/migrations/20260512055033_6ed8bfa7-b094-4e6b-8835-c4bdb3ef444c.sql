CREATE TABLE public.bus_lines (
  code text PRIMARY KEY,
  name text NOT NULL,
  color text,
  operator text DEFAULT 'Vectalia',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.bus_line_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_code text NOT NULL REFERENCES public.bus_lines(code) ON DELETE CASCADE,
  direction smallint NOT NULL CHECK (direction IN (1,2)),
  seq integer NOT NULL,
  stop_name text NOT NULL,
  stop_code text REFERENCES public.bus_stops(code) ON DELETE SET NULL,
  transfer_lines text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (line_code, direction, seq)
);

CREATE INDEX idx_bus_line_stops_line_dir ON public.bus_line_stops(line_code, direction, seq);
CREATE INDEX idx_bus_line_stops_stop_code ON public.bus_line_stops(stop_code);

ALTER TABLE public.bus_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bus_line_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bus lines publicly readable" ON public.bus_lines FOR SELECT USING (true);
CREATE POLICY "Bus line stops publicly readable" ON public.bus_line_stops FOR SELECT USING (true);

CREATE TRIGGER trg_bus_lines_updated_at
  BEFORE UPDATE ON public.bus_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();