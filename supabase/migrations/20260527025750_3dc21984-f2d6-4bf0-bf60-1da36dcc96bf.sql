
CREATE TABLE IF NOT EXISTS public.bus_line_departures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_code text NOT NULL,
  day_type text NOT NULL,
  direction smallint NOT NULL,
  departure_time time NOT NULL,
  estimated boolean NOT NULL DEFAULT false,
  source text DEFAULT 'vectalia',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bus_line_departures TO anon, authenticated;
GRANT ALL ON public.bus_line_departures TO service_role;

ALTER TABLE public.bus_line_departures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read bus_line_departures" ON public.bus_line_departures FOR SELECT USING (true);
CREATE POLICY "Admins manage bus_line_departures" ON public.bus_line_departures FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_bus_line_departures_lookup ON public.bus_line_departures(line_code, day_type, direction, departure_time);
