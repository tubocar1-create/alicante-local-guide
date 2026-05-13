UPDATE public.bookings
SET user_id = '5cf72db3-6a97-4078-9039-8a3cbf654060'
WHERE user_id IS NULL;

UPDATE public.conversation_threads
SET user_id = '5cf72db3-6a97-4078-9039-8a3cbf654060'
WHERE user_id IS NULL;