
ALTER TABLE public.hotels_dynamic
  ADD COLUMN IF NOT EXISTS room_types jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.hotels_calendar (
  hotel_id uuid NOT NULL,
  date date NOT NULL,
  available boolean NOT NULL DEFAULT false,
  price_double numeric,
  price_min numeric,
  currency text DEFAULT 'EUR',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (hotel_id, date)
);

ALTER TABLE public.hotels_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read hotels_calendar"
  ON public.hotels_calendar FOR SELECT
  USING (true);

CREATE POLICY "Admins manage hotels_calendar"
  ON public.hotels_calendar FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_hotels_calendar_hotel_date
  ON public.hotels_calendar (hotel_id, date);
