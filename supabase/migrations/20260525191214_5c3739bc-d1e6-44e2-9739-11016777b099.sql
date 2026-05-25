REVOKE ALL ON FUNCTION public.refresh_tram_live_departures(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_aena_flights(interval) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_tram_expired_services() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.refresh_tram_live_departures(timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_aena_flights(interval) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_tram_expired_services() TO service_role;