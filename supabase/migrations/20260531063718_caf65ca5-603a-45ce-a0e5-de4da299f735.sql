UPDATE public.places
SET photo_scrape_status = 'chain',
    photo_scrape_at = now(),
    scraped_photos = NULL
WHERE name ~* '(mcdonald|burger king|^kfc| kfc|taco bell|five guys|goiko|popeyes|^tgb|good burger|good burguer|foster.?s hollywood|^vips$|telepizza|domino|pizza hut|papa john|pans ?\& ?company|100 montaditos|la sure(ñ|n)a|lizarran|ginos|^ribs |^ribs$|starbucks|dunkin|santagloria|bombon boss|^subway$|^vicio$| vicio|^udon | udon|muerde la pasta)';