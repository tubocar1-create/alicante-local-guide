
-- Fix 1: Restrict event_sources to admins only (internal scraping infrastructure)
DROP POLICY IF EXISTS "Event sources are publicly viewable" ON public.event_sources;

CREATE POLICY "Admins read event_sources"
ON public.event_sources
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage event_sources"
ON public.event_sources
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: Tighten interaction_events INSERT to verify business membership
DROP POLICY IF EXISTS "Auth users insert events" ON public.interaction_events;

CREATE POLICY "Auth users insert own events"
ON public.interaction_events
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (user_id IS NULL OR user_id = auth.uid())
  AND (
    business_id IS NULL
    OR public.is_business_member(auth.uid(), business_id)
  )
);
