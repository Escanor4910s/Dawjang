
CREATE TABLE IF NOT EXISTS public.edge_diagnostics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name text NOT NULL,
  user_id uuid,
  status int,
  request_payload jsonb,
  response_payload jsonb,
  error text,
  duration_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.edge_diagnostics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view diagnostics"
  ON public.edge_diagnostics FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Only admins can delete diagnostics"
  ON public.edge_diagnostics FOR DELETE
  USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_edge_diagnostics_created_at ON public.edge_diagnostics (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_edge_diagnostics_function ON public.edge_diagnostics (function_name, created_at DESC);
