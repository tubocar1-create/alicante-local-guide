
CREATE OR REPLACE FUNCTION public.purge_daily_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_showtimes integer;
  v_films integer;
BEGIN
  v_showtimes := public.purge_showtimes_past(interval '1 day');
  v_films := public.purge_films_orphan();
  RETURN jsonb_build_object(
    'showtimes_past', v_showtimes,
    'films_orphan', v_films,
    'ran_at', now()
  );
END; $$;
