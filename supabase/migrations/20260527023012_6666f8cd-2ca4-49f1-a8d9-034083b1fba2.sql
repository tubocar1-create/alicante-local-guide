CREATE TABLE public.bus_line_service_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_code text NOT NULL,
  direction smallint NOT NULL,
  terminal_name text NOT NULL,
  day_type text NOT NULL CHECK (day_type IN ('laborable','sabado','domingo','festivo')),
  first_departure time NOT NULL,
  last_departure time NOT NULL,
  source text DEFAULT 'vectalia',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (line_code, direction, day_type)
);

GRANT SELECT ON public.bus_line_service_windows TO anon, authenticated;
GRANT ALL ON public.bus_line_service_windows TO service_role;

ALTER TABLE public.bus_line_service_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read service windows"
ON public.bus_line_service_windows FOR SELECT
USING (true);

CREATE POLICY "Admins manage service windows"
ON public.bus_line_service_windows FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_bus_line_service_windows_updated_at
BEFORE UPDATE ON public.bus_line_service_windows
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();