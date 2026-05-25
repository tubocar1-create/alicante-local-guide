
REVOKE EXECUTE ON FUNCTION public.purge_interaction_events(interval) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_agente_learning_log(interval) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_agente_unknown_queries(interval) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_agente_unknown_query_actions(interval) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_operational_event_reviews(interval) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_hotels_calendar_past() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_showtimes_past(interval) FROM PUBLIC, anon, authenticated;
