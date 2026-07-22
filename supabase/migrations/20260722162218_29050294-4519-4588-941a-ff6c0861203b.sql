
CREATE TABLE public.health_check (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'ok',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.health_check TO anon, authenticated;
GRANT ALL ON public.health_check TO service_role;

ALTER TABLE public.health_check ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Health check readable by everyone"
  ON public.health_check FOR SELECT
  USING (true);

INSERT INTO public.health_check (status) VALUES ('ok');
