
-- =====================================================
-- HARDENING DE SEGURIDAD PRE-LANZAMIENTO (TANDA 1)
-- =====================================================

-- 1) Eliminar tabla test_users (PII expuesta públicamente)
DROP TABLE IF EXISTS public.test_users CASCADE;

-- 2) FORCE ROW LEVEL SECURITY en tablas sensibles
--    (impide que el propietario de la tabla bypass-ee RLS por accidente)
ALTER TABLE public.profiles              FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles            FORCE ROW LEVEL SECURITY;
ALTER TABLE public.bookings              FORCE ROW LEVEL SECURITY;
ALTER TABLE public.messages              FORCE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_threads  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.referrals             FORCE ROW LEVEL SECURITY;
ALTER TABLE public.qr_codes              FORCE ROW LEVEL SECURITY;
ALTER TABLE public.business_users        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.businesses            FORCE ROW LEVEL SECURITY;
ALTER TABLE public.visits                FORCE ROW LEVEL SECURITY;
ALTER TABLE public.interaction_events    FORCE ROW LEVEL SECURITY;

-- 3) REVOKE EXECUTE en funciones SECURITY DEFINER desde anon/public
--    El service_role y authenticated mantienen acceso.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role)            FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_business_member(uuid, uuid)      FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                   FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.bump_thread_last_message()          FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_thread_for_booking()         FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()          FROM anon, public;

-- 4) Endurecer INSERT en bookings: exigir que el user_id coincida con auth.uid()
DROP POLICY IF EXISTS "Anyone can create booking" ON public.bookings;
CREATE POLICY "Users create own bookings"
ON public.bookings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 5) Endurecer INSERT en referrals: exigir referrer_user_id = auth.uid()
DROP POLICY IF EXISTS "Auth users create referrals" ON public.referrals;
CREATE POLICY "Users create own referrals"
ON public.referrals
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = referrer_user_id);
