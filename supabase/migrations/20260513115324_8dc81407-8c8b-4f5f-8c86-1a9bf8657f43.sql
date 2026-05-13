DROP TRIGGER IF EXISTS trg_create_thread_for_booking ON public.bookings;
CREATE TRIGGER trg_create_thread_for_booking
AFTER INSERT ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.create_thread_for_booking();

DROP TRIGGER IF EXISTS trg_bump_thread_last_message ON public.messages;
CREATE TRIGGER trg_bump_thread_last_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.bump_thread_last_message();

DO $$
DECLARE
  b RECORD;
  v_thread_id uuid;
BEGIN
  FOR b IN
    SELECT bk.*
    FROM public.bookings bk
    LEFT JOIN public.conversation_threads ct ON ct.booking_id = bk.id
    WHERE ct.id IS NULL
  LOOP
    INSERT INTO public.conversation_threads (booking_id, business_id, user_id, status, context_snapshot)
    VALUES (
      b.id, b.business_id, b.user_id, 'awaiting_business',
      jsonb_build_object(
        'service_id', b.service_id,
        'scheduled_at', b.scheduled_at,
        'party_size', b.party_size,
        'customer_name', b.customer_name
      )
    )
    RETURNING id INTO v_thread_id;

    INSERT INTO public.messages (thread_id, sender_type, message_type, template_key, payload, requires_action)
    VALUES (
      v_thread_id, 'system', 'system_event', 'booking_created',
      jsonb_build_object('booking_id', b.id, 'scheduled_at', b.scheduled_at),
      true
    );
  END LOOP;
END $$;