ALTER TABLE public.showtimes
  ADD CONSTRAINT showtimes_unique_slot
  UNIQUE (cinema_id, film_id, starts_at);
