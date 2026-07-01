CREATE TABLE IF NOT EXISTS public.nium_webhook_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT,
  event_type TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('accepted','rejected','duplicate')),
  reason TEXT,
  status_code INT,
  client_ip TEXT,
  user_agent TEXT,
  had_signature_key BOOLEAN NOT NULL DEFAULT false,
  had_hmac_signature BOOLEAN NOT NULL DEFAULT false,
  body_bytes INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nium_webhook_audit_created ON public.nium_webhook_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nium_webhook_audit_outcome ON public.nium_webhook_audit (outcome, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nium_webhook_audit_event_id ON public.nium_webhook_audit (event_id);

GRANT SELECT ON public.nium_webhook_audit TO authenticated;
GRANT ALL ON public.nium_webhook_audit TO service_role;

ALTER TABLE public.nium_webhook_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read nium webhook audit"
  ON public.nium_webhook_audit FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));