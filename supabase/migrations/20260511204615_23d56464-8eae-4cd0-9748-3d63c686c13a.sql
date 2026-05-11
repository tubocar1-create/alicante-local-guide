CREATE TABLE public.bus_stops (
  code TEXT NOT NULL PRIMARY KEY,
  name TEXT,
  lines TEXT[],
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bus_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bus stops are publicly readable"
ON public.bus_stops
FOR SELECT
USING (true);

CREATE TRIGGER update_bus_stops_updated_at
BEFORE UPDATE ON public.bus_stops
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();