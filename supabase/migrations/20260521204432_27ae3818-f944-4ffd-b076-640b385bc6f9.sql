UPDATE public.shop_businesses
SET logo_url = 'https://icons.duckduckgo.com/ip3/' || regexp_replace(regexp_replace(website, '^https?://(www\.)?', ''), '/.*$', '') || '.ico'
WHERE website IS NOT NULL AND website <> '' AND logo_url IS NOT NULL;