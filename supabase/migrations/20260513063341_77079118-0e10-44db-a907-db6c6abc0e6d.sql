
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('public_user', 'business_user', 'admin');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users see own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ BUSINESSES ============
CREATE TABLE public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sector TEXT NOT NULL,
  description TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  address TEXT,
  phone TEXT,
  email TEXT,
  whatsapp TEXT,
  website TEXT,
  opening_hours JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.business_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','manager','staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);
ALTER TABLE public.business_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_business_member(_user_id UUID, _business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_users
    WHERE user_id = _user_id AND business_id = _business_id
  ) OR EXISTS (
    SELECT 1 FROM public.businesses
    WHERE id = _business_id AND owner_id = _user_id
  )
$$;

CREATE POLICY "Businesses publicly readable" ON public.businesses
  FOR SELECT USING (active = true OR owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners insert businesses" ON public.businesses
  FOR INSERT WITH CHECK (auth.uid() = owner_id AND public.has_role(auth.uid(), 'business_user'));
CREATE POLICY "Owners update own business" ON public.businesses
  FOR UPDATE USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners delete own business" ON public.businesses
  FOR DELETE USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members see business_users" ON public.business_users
  FOR SELECT USING (public.is_business_member(auth.uid(), business_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners manage business_users" ON public.business_users
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- ============ SERVICES ============
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  price_cents INTEGER,
  currency TEXT DEFAULT 'EUR',
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Services publicly readable" ON public.services
  FOR SELECT USING (active = true OR public.is_business_member(auth.uid(), business_id));
CREATE POLICY "Members manage services" ON public.services
  FOR ALL USING (public.is_business_member(auth.uid(), business_id))
  WITH CHECK (public.is_business_member(auth.uid(), business_id));

-- ============ BOOKINGS ============
CREATE TYPE public.booking_status AS ENUM ('pending','confirmed','cancelled','completed','no_show');

CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  party_size INTEGER NOT NULL DEFAULT 1,
  status booking_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers see own bookings" ON public.bookings
  FOR SELECT USING (auth.uid() = user_id OR public.is_business_member(auth.uid(), business_id));
CREATE POLICY "Anyone can create booking" ON public.bookings
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Members update bookings" ON public.bookings
  FOR UPDATE USING (public.is_business_member(auth.uid(), business_id) OR auth.uid() = user_id);
CREATE POLICY "Members delete bookings" ON public.bookings
  FOR DELETE USING (public.is_business_member(auth.uid(), business_id));

-- ============ QR CODES ============
CREATE TYPE public.qr_purpose AS ENUM ('visit','referral','promo','booking','campaign');

CREATE TABLE public.qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  purpose qr_purpose NOT NULL DEFAULT 'visit',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  campaign_id UUID,
  expires_at TIMESTAMPTZ,
  max_uses INTEGER,
  uses INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see qr_codes" ON public.qr_codes
  FOR SELECT USING (public.is_business_member(auth.uid(), business_id));
CREATE POLICY "Members manage qr_codes" ON public.qr_codes
  FOR ALL USING (public.is_business_member(auth.uid(), business_id))
  WITH CHECK (public.is_business_member(auth.uid(), business_id));

-- ============ VISITS ============
CREATE TABLE public.visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  qr_id UUID REFERENCES public.qr_codes(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see visits" ON public.visits
  FOR SELECT USING (public.is_business_member(auth.uid(), business_id) OR auth.uid() = user_id);
CREATE POLICY "Auth users insert visits" ON public.visits
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============ REFERRALS ============
CREATE TYPE public.referral_status AS ENUM ('pending','converted','expired');

CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  referrer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  status referral_status NOT NULL DEFAULT 'pending',
  campaign_id UUID,
  converted_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_referrals_code ON public.referrals(code);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members and referrer see referrals" ON public.referrals
  FOR SELECT USING (
    public.is_business_member(auth.uid(), business_id)
    OR auth.uid() = referrer_user_id
    OR auth.uid() = referred_user_id
  );
CREATE POLICY "Auth users create referrals" ON public.referrals
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Members update referrals" ON public.referrals
  FOR UPDATE USING (public.is_business_member(auth.uid(), business_id));

-- ============ CAMPAIGNS ============
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'generic',
  description TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see campaigns" ON public.campaigns
  FOR SELECT USING (public.is_business_member(auth.uid(), business_id) OR active = true);
CREATE POLICY "Members manage campaigns" ON public.campaigns
  FOR ALL USING (public.is_business_member(auth.uid(), business_id))
  WITH CHECK (public.is_business_member(auth.uid(), business_id));

-- ============ INTERACTION EVENTS ============
CREATE TABLE public.interaction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  source TEXT,
  conversion_status TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_events_business_time ON public.interaction_events(business_id, occurred_at DESC);
CREATE INDEX idx_events_type ON public.interaction_events(type);
ALTER TABLE public.interaction_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see business events" ON public.interaction_events
  FOR SELECT USING (
    (business_id IS NOT NULL AND public.is_business_member(auth.uid(), business_id))
    OR auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Auth users insert events" ON public.interaction_events
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============ TIMESTAMPS ============
CREATE TRIGGER trg_businesses_updated BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_services_updated BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_bookings_updated BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
