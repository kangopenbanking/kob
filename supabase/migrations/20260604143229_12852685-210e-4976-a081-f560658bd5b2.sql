
-- Idempotency cache for unified-kyc-gateway
CREATE TABLE IF NOT EXISTS public.kyc_gateway_idempotency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  trace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  UNIQUE (idempotency_key, user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_kyc_idem_expires ON public.kyc_gateway_idempotency(expires_at);

GRANT SELECT ON public.kyc_gateway_idempotency TO authenticated;
GRANT ALL ON public.kyc_gateway_idempotency TO service_role;
ALTER TABLE public.kyc_gateway_idempotency ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kyc_idem_admin_read" ON public.kyc_gateway_idempotency
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Per-country breakdown for metrics
ALTER TABLE public.kyc_verification_audit ADD COLUMN IF NOT EXISTS country TEXT;
CREATE INDEX IF NOT EXISTS idx_kyc_audit_country ON public.kyc_verification_audit(country, created_at DESC);
