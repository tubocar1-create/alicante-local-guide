
UPDATE public.pharmacies
SET is_24h = true, hours = 'Abierto 24 horas', phone = COALESCE(phone, '966 93 72 63')
WHERE name = 'VICENTE SANTAMARIA, EDUARDO';

UPDATE public.pharmacies
SET is_24h = true, hours = 'Abierto 24 horas', phone = COALESCE(phone, '965 17 74 63')
WHERE name = 'MEDINA GALVEZ, IGNACIO MANUEL';

INSERT INTO public.pharmacies (code, name, address, postal_code, city, phone, is_24h, on_duty, hours)
VALUES ('GRANVIA24H', 'FARMACIA 24H GRAN VIA ALICANTE', 'AV. PINTOR XAVIER SOLER, Nº2, LOCAL 4-7', '03015', 'Alicante', '965 91 02 20', true, true, 'Abierto 24 horas');
