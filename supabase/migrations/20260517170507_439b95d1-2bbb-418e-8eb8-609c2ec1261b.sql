-- CINEMAS
CREATE TABLE public.cinemas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  brand text,
  address text,
  lat double precision,
  lng double precision,
  phone text,
  website text,
  ticket_url text,
  opening_hours jsonb,
  photos text[] NOT NULL DEFAULT '{}',
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cinemas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read cinemas" ON public.cinemas FOR SELECT USING (true);
CREATE POLICY "Admins manage cinemas" ON public.cinemas FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_cinemas_updated_at BEFORE UPDATE ON public.cinemas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FILMS
CREATE TABLE public.films (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  original_title text,
  duration_min integer,
  genre text,
  language text,
  age_rating text,
  poster_url text,
  trailer_url text,
  synopsis text,
  director text,
  cast_list text[] NOT NULL DEFAULT '{}',
  release_date date,
  external_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.films ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read films" ON public.films FOR SELECT USING (true);
CREATE POLICY "Admins manage films" ON public.films FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_films_updated_at BEFORE UPDATE ON public.films
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SHOWTIMES
CREATE TABLE public.showtimes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cinema_id uuid NOT NULL REFERENCES public.cinemas(id) ON DELETE CASCADE,
  film_id uuid NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  room text,
  version text, -- VOSE, DUB, VO
  format text, -- 2D, 3D, IMAX, 4DX
  price_eur numeric(6,2),
  ticket_url text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.showtimes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read showtimes" ON public.showtimes FOR SELECT USING (true);
CREATE POLICY "Admins manage showtimes" ON public.showtimes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_showtimes_cinema_starts ON public.showtimes (cinema_id, starts_at);
CREATE INDEX idx_showtimes_film_starts ON public.showtimes (film_id, starts_at);
CREATE UNIQUE INDEX uq_showtimes_unique ON public.showtimes (cinema_id, film_id, starts_at, COALESCE(room, ''), COALESCE(version, ''), COALESCE(format, ''));