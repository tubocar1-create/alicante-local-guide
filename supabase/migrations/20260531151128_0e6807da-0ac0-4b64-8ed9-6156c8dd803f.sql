CREATE TABLE public.train_schedule_snapshot (
  id text PRIMARY KEY,
  generated_at timestamptz NOT NULL DEFAULT now(),
  date_start date NOT NULL,
  date_end date NOT NULL,
  payload jsonb NOT NULL,
  source text NOT NULL DEFAULT 'gtfs-renfe-nap',
  trips_count integer NOT NULL DEFAULT 0
);

GRANT SELECT ON public.train_schedule_snapshot TO anon;
GRANT SELECT ON public.train_schedule_snapshot TO authenticated;
GRANT ALL ON public.train_schedule_snapshot TO service_role;

ALTER TABLE public.train_schedule_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read train snapshot"
ON public.train_schedule_snapshot
FOR SELECT
USING (true);

CREATE POLICY "Admins manage train snapshot"
ON public.train_schedule_snapshot
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));