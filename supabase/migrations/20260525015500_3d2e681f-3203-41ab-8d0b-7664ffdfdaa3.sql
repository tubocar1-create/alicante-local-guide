
CREATE TABLE public.beach_covers (
  slug TEXT PRIMARY KEY,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  attribution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.beach_covers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read beach_covers"
ON public.beach_covers FOR SELECT
USING (true);

CREATE POLICY "Admins manage beach_covers"
ON public.beach_covers FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER beach_covers_updated_at
BEFORE UPDATE ON public.beach_covers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
VALUES ('beach-photos', 'beach-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read beach-photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'beach-photos');

CREATE POLICY "Admins write beach-photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'beach-photos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update beach-photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'beach-photos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete beach-photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'beach-photos' AND has_role(auth.uid(), 'admin'::app_role));
