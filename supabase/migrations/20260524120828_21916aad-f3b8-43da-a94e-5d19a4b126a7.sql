-- Public bucket for cached Google Places photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-photos', 'shop-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "Shop photos are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'shop-photos');

-- Only service role writes (server-side via supabaseAdmin); no anon insert policy.