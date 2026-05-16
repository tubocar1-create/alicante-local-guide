UPDATE public.pharmacies
SET is_24h = false,
    on_duty = false,
    hours = 'L-V 9:00-21:00 · Sáb 9:00-14:00 · Dom cerrado',
    phone = '965 21 21 19'
WHERE id = '993362d3-8ea7-4b3a-b190-3ba61ed898fc';