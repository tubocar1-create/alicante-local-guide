-- TRAM d'Alacant GTFS schema
-- Source: NAP (Ministerio de Transportes) - FGV Generalitat Valenciana
-- Feed: https://nap.transportes.gob.es/api/Fichero/download/1167

CREATE TABLE public.tram_feed_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url text NOT NULL,
  sha1 text,
  size_bytes integer,
  feed_start_date date,
  feed_end_date date,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  notes text
);

CREATE TABLE public.tram_agencies (
  agency_id text PRIMARY KEY,
  agency_name text NOT NULL,
  agency_url text,
  agency_timezone text,
  agency_lang text,
  agency_phone text,
  agency_email text
);

CREATE TABLE public.tram_routes (
  route_id text PRIMARY KEY,
  agency_id text REFERENCES public.tram_agencies(agency_id) ON DELETE SET NULL,
  route_short_name text,
  route_long_name text,
  route_desc text,
  route_type integer,
  route_color text,
  route_text_color text,
  route_url text,
  sort_order integer
);

CREATE TABLE public.tram_stops (
  stop_id text PRIMARY KEY,
  stop_code text,
  stop_name text NOT NULL,
  stop_desc text,
  lat double precision,
  lng double precision,
  zone_id text,
  stop_url text,
  location_type integer,
  parent_station text,
  wheelchair_boarding integer,
  platform_code text
);
CREATE INDEX tram_stops_parent_idx ON public.tram_stops(parent_station);
CREATE INDEX tram_stops_name_idx ON public.tram_stops(stop_name);

CREATE TABLE public.tram_calendar (
  service_id text PRIMARY KEY,
  monday boolean NOT NULL DEFAULT false,
  tuesday boolean NOT NULL DEFAULT false,
  wednesday boolean NOT NULL DEFAULT false,
  thursday boolean NOT NULL DEFAULT false,
  friday boolean NOT NULL DEFAULT false,
  saturday boolean NOT NULL DEFAULT false,
  sunday boolean NOT NULL DEFAULT false,
  start_date date NOT NULL,
  end_date date NOT NULL
);

CREATE TABLE public.tram_calendar_dates (
  service_id text NOT NULL,
  date date NOT NULL,
  exception_type integer NOT NULL, -- 1=added, 2=removed
  PRIMARY KEY (service_id, date)
);
CREATE INDEX tram_caldates_date_idx ON public.tram_calendar_dates(date);

CREATE TABLE public.tram_trips (
  trip_id text PRIMARY KEY,
  route_id text NOT NULL REFERENCES public.tram_routes(route_id) ON DELETE CASCADE,
  service_id text NOT NULL,
  trip_headsign text,
  trip_short_name text,
  direction_id integer,
  block_id text,
  shape_id text,
  wheelchair_accessible integer,
  bikes_allowed integer
);
CREATE INDEX tram_trips_route_idx ON public.tram_trips(route_id);
CREATE INDEX tram_trips_service_idx ON public.tram_trips(service_id);
CREATE INDEX tram_trips_shape_idx ON public.tram_trips(shape_id);

CREATE TABLE public.tram_stop_times (
  trip_id text NOT NULL REFERENCES public.tram_trips(trip_id) ON DELETE CASCADE,
  stop_sequence integer NOT NULL,
  stop_id text NOT NULL REFERENCES public.tram_stops(stop_id) ON DELETE CASCADE,
  -- Times stored as seconds-from-midnight to support 24:xx:xx GTFS times
  arrival_seconds integer,
  departure_seconds integer,
  stop_headsign text,
  pickup_type integer,
  drop_off_type integer,
  shape_dist_traveled double precision,
  timepoint integer,
  PRIMARY KEY (trip_id, stop_sequence)
);
CREATE INDEX tram_stop_times_stop_idx ON public.tram_stop_times(stop_id);
CREATE INDEX tram_stop_times_dep_idx ON public.tram_stop_times(stop_id, departure_seconds);

CREATE TABLE public.tram_shapes (
  shape_id text NOT NULL,
  shape_pt_sequence integer NOT NULL,
  shape_pt_lat double precision NOT NULL,
  shape_pt_lng double precision NOT NULL,
  shape_dist_traveled double precision,
  PRIMARY KEY (shape_id, shape_pt_sequence)
);

-- RLS: public read, admin write
ALTER TABLE public.tram_feed_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tram_agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tram_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tram_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tram_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tram_stop_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tram_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tram_calendar_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tram_shapes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tram_feed_versions','tram_agencies','tram_routes','tram_stops',
    'tram_trips','tram_stop_times','tram_calendar','tram_calendar_dates','tram_shapes'
  ]
  LOOP
    EXECUTE format('CREATE POLICY "Public read %1$s" ON public.%1$s FOR SELECT USING (true);', t);
    EXECUTE format('CREATE POLICY "Admins manage %1$s" ON public.%1$s FOR ALL USING (has_role(auth.uid(), ''admin''::app_role)) WITH CHECK (has_role(auth.uid(), ''admin''::app_role));', t);
  END LOOP;
END$$;