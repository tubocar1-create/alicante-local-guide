-- Cambiar el default de purge_showtimes_past de 7 días a 1 día
CREATE OR REPLACE FUNCTION public.purge_showtimes_past(p_retention interval DEFAULT '1 day'::interval)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_rows integer := 0;
BEGIN
  DELETE FROM public.showtimes WHERE starts_at < (now() - COALESCE(p_retention, interval '1 day'));
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END; $function$;

-- Ejecutar purga inmediata con retención de 1 día
SELECT public.purge_showtimes_past('1 day'::interval);