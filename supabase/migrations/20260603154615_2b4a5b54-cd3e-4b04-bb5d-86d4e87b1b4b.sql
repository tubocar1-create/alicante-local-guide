ALTER TABLE public.firecrawl_call_log ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.firecrawl_call_log ADD COLUMN IF NOT EXISTS visitor_id text;
CREATE INDEX IF NOT EXISTS firecrawl_call_log_visitor_created_idx ON public.firecrawl_call_log (visitor_id, created_at DESC);