-- Reassign existing booking + thread + events from anonymous shadow business
-- to the owned "Tumbarancho" so the business owner can see and respond to it.
UPDATE public.bookings
  SET business_id = '72fbb8a0-582b-496c-8409-2191ab63b542'
  WHERE business_id = '223da63f-0932-49a0-a037-4d14daa1b5a1';

UPDATE public.conversation_threads
  SET business_id = '72fbb8a0-582b-496c-8409-2191ab63b542'
  WHERE business_id = '223da63f-0932-49a0-a037-4d14daa1b5a1';

UPDATE public.interaction_events
  SET business_id = '72fbb8a0-582b-496c-8409-2191ab63b542'
  WHERE business_id = '223da63f-0932-49a0-a037-4d14daa1b5a1';

-- Drop duplicate empty shadow businesses for the same place (keep only the owned row).
DELETE FROM public.businesses
  WHERE id IN (
    '223da63f-0932-49a0-a037-4d14daa1b5a1',
    'a80ff66a-d2bf-44af-b966-0d8e0a221e40',
    '573b1e51-54db-4628-be69-c04a478cf4f8',
    '084d2784-9fd7-4b21-ad01-292272641b69'
  );