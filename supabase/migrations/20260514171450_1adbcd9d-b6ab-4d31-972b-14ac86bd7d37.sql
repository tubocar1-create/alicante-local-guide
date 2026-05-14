CREATE TABLE public.aena_flights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airport text NOT NULL,
  flight_type text NOT NULL CHECK (flight_type IN ('S','L')),
  num_vuelo text NOT NULL,
  fecha text NOT NULL,
  hora_programada text NOT NULL,
  hora_estimada text,
  scheduled_at timestamptz NOT NULL,
  iata_otro text,
  ciudad text,
  estado text,
  terminal text,
  puerta text,
  mostrador text,
  compania text,
  iata_compania text,
  aeronave text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (airport, flight_type, num_vuelo, fecha, hora_programada)
);

CREATE INDEX aena_flights_lookup_idx ON public.aena_flights (airport, flight_type, scheduled_at);

ALTER TABLE public.aena_flights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read aena_flights"
  ON public.aena_flights
  FOR SELECT
  USING (true);
