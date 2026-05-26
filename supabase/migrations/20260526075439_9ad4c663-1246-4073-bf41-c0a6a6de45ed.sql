
-- =========================================
-- 1. VENUES (recintos)
-- =========================================
CREATE TABLE public.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'otro',
  address text,
  lat double precision,
  lng double precision,
  phone text,
  website text,
  cover_url text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Venues are publicly viewable"
  ON public.venues FOR SELECT
  USING (true);

CREATE TRIGGER trg_venues_updated
  BEFORE UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- 2. EVENTS (eventos)
-- =========================================
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'otro',
  description text,
  poster_url text,
  duration_min integer,
  age_rating text,
  genre text,
  artist text,
  source_url text,
  external_ids jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events are publicly viewable"
  ON public.events FOR SELECT
  USING (true);

CREATE TRIGGER trg_events_updated
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_events_category ON public.events(category);

-- =========================================
-- 3. EVENT_SHOWTIMES (pases)
-- =========================================
CREATE TABLE public.event_showtimes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  price_min numeric(10,2),
  price_max numeric(10,2),
  currency text DEFAULT 'EUR',
  ticket_url text,
  availability text DEFAULT 'n/d',
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, venue_id, starts_at)
);

ALTER TABLE public.event_showtimes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event showtimes are publicly viewable"
  ON public.event_showtimes FOR SELECT
  USING (true);

CREATE INDEX idx_event_showtimes_starts_at ON public.event_showtimes(starts_at);
CREATE INDEX idx_event_showtimes_venue ON public.event_showtimes(venue_id);
CREATE INDEX idx_event_showtimes_event ON public.event_showtimes(event_id);

-- Trigger: starts_at no puede superar el 31/12/2026 (Europe/Madrid → 22:59 UTC)
CREATE OR REPLACE FUNCTION public.validate_event_showtime_horizon()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.starts_at > '2026-12-31 22:59:59+00'::timestamptz THEN
    RAISE EXCEPTION 'starts_at supera el horizonte permitido (31/12/2026 23:59 Madrid)';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_event_showtimes_horizon
  BEFORE INSERT OR UPDATE ON public.event_showtimes
  FOR EACH ROW EXECUTE FUNCTION public.validate_event_showtime_horizon();

-- =========================================
-- 4. EVENT_SOURCES (fuentes para scraper)
-- =========================================
CREATE TABLE public.event_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  url text NOT NULL,
  parser text DEFAULT 'firecrawl_ai',
  enabled boolean NOT NULL DEFAULT true,
  last_scraped_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event sources are publicly viewable"
  ON public.event_sources FOR SELECT
  USING (true);

-- =========================================
-- 5. PURGE FUNCTIONS
-- =========================================
CREATE OR REPLACE FUNCTION public.purge_event_showtimes_past(p_retention interval DEFAULT '1 day'::interval)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_rows integer := 0;
BEGIN
  DELETE FROM public.event_showtimes
  WHERE starts_at < (now() - COALESCE(p_retention, interval '1 day'));
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_events_orphan()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_rows integer := 0;
BEGIN
  DELETE FROM public.events e
  WHERE NOT EXISTS (
    SELECT 1 FROM public.event_showtimes s WHERE s.event_id = e.id
  );
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;
