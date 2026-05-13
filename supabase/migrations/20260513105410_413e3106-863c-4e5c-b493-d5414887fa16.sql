
-- Enums
DO $$ BEGIN
  CREATE TYPE public.thread_status AS ENUM ('open','awaiting_user','awaiting_business','closed','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.message_sender AS ENUM ('user','business','system','ai');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.message_kind AS ENUM ('quick_reply','free_text','system_event','eta_update','location','qr','slot_proposal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Threads
CREATE TABLE IF NOT EXISTS public.conversation_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE,
  business_id uuid NOT NULL,
  user_id uuid,
  status public.thread_status NOT NULL DEFAULT 'awaiting_business',
  context_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_threads_business ON public.conversation_threads(business_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_user ON public.conversation_threads(user_id, last_message_at DESC);

ALTER TABLE public.conversation_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants see threads" ON public.conversation_threads;
CREATE POLICY "Participants see threads" ON public.conversation_threads
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.is_business_member(auth.uid(), business_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Members update threads" ON public.conversation_threads;
CREATE POLICY "Members update threads" ON public.conversation_threads
  FOR UPDATE USING (
    public.is_business_member(auth.uid(), business_id)
    OR auth.uid() = user_id
  );

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.conversation_threads(id) ON DELETE CASCADE,
  sender_type public.message_sender NOT NULL,
  sender_user_id uuid,
  message_type public.message_kind NOT NULL DEFAULT 'quick_reply',
  template_key text,
  text text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  requires_action boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_text_len CHECK (text IS NULL OR char_length(text) <= 280)
);

CREATE INDEX IF NOT EXISTS idx_messages_thread ON public.messages(thread_id, created_at);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants see messages" ON public.messages;
CREATE POLICY "Participants see messages" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversation_threads t
      WHERE t.id = messages.thread_id
        AND (
          auth.uid() = t.user_id
          OR public.is_business_member(auth.uid(), t.business_id)
          OR public.has_role(auth.uid(), 'admin'::app_role)
        )
    )
  );

DROP POLICY IF EXISTS "Participants insert messages" ON public.messages;
CREATE POLICY "Participants insert messages" ON public.messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversation_threads t
      WHERE t.id = messages.thread_id
        AND t.status NOT IN ('closed','expired')
        AND (
          auth.uid() = t.user_id
          OR public.is_business_member(auth.uid(), t.business_id)
        )
    )
  );

DROP POLICY IF EXISTS "Participants update own messages" ON public.messages;
CREATE POLICY "Participants update own messages" ON public.messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.conversation_threads t
      WHERE t.id = messages.thread_id
        AND (auth.uid() = t.user_id OR public.is_business_member(auth.uid(), t.business_id))
    )
  );

-- Trigger: bump last_message_at
CREATE OR REPLACE FUNCTION public.bump_thread_last_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.conversation_threads
    SET last_message_at = NEW.created_at
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_messages_bump ON public.messages;
CREATE TRIGGER trg_messages_bump AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.bump_thread_last_message();

-- Trigger: auto-create thread on new booking
CREATE OR REPLACE FUNCTION public.create_thread_for_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_thread_id uuid;
BEGIN
  INSERT INTO public.conversation_threads (booking_id, business_id, user_id, status, context_snapshot)
  VALUES (
    NEW.id, NEW.business_id, NEW.user_id, 'awaiting_business',
    jsonb_build_object(
      'service_id', NEW.service_id,
      'scheduled_at', NEW.scheduled_at,
      'party_size', NEW.party_size,
      'customer_name', NEW.customer_name
    )
  )
  RETURNING id INTO v_thread_id;

  INSERT INTO public.messages (thread_id, sender_type, message_type, template_key, payload, requires_action)
  VALUES (
    v_thread_id, 'system', 'system_event', 'booking_created',
    jsonb_build_object('booking_id', NEW.id, 'scheduled_at', NEW.scheduled_at),
    true
  );
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_booking_thread ON public.bookings;
CREATE TRIGGER trg_booking_thread AFTER INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.create_thread_for_booking();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_threads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER TABLE public.conversation_threads REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
