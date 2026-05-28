-- Enable RLS on realtime.messages and restrict channel subscriptions to legitimate participants
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can subscribe to authorized topics" ON realtime.messages;

CREATE POLICY "Authenticated can subscribe to authorized topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- thread:<thread_id> — only participants (user or business member) of that thread
  (
    realtime.topic() LIKE 'thread:%'
    AND EXISTS (
      SELECT 1
      FROM public.conversation_threads t
      WHERE t.id::text = split_part(realtime.topic(), ':', 2)
        AND (
          t.user_id = auth.uid()
          OR public.is_business_member(auth.uid(), t.business_id)
        )
    )
  )
  OR
  -- inbox:<business_id> — only members of that business
  (
    realtime.topic() LIKE 'inbox:%'
    AND public.is_business_member(
      auth.uid(),
      NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
    )
  )
  OR
  -- bookings:<business_id> — only members of that business
  (
    realtime.topic() LIKE 'bookings:%'
    AND public.is_business_member(
      auth.uid(),
      NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
    )
  )
);