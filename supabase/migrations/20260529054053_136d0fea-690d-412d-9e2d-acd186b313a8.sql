
ALTER TABLE public.interaction_events
  ADD COLUMN IF NOT EXISTS visitor_id text,
  ADD COLUMN IF NOT EXISTS ip_trunc text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS device text,
  ADD COLUMN IF NOT EXISTS browser text,
  ADD COLUMN IF NOT EXISTS os text,
  ADD COLUMN IF NOT EXISTS referrer text,
  ADD COLUMN IF NOT EXISTS utm jsonb,
  ADD COLUMN IF NOT EXISTS path text;

CREATE INDEX IF NOT EXISTS idx_interaction_events_visitor_id_occurred
  ON public.interaction_events (visitor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_interaction_events_user_id_occurred
  ON public.interaction_events (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_interaction_events_occurred
  ON public.interaction_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_interaction_events_country
  ON public.interaction_events (country);
CREATE INDEX IF NOT EXISTS idx_interaction_events_path
  ON public.interaction_events (path);
