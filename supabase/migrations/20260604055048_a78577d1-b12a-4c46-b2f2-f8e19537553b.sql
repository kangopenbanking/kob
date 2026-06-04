
-- Unified KYC Gateway: feature flags, audit log, and Youverify session linkage
-- Additive only. No existing tables modified beyond new nullable columns.

CREATE TABLE IF NOT EXISTS public.kyc_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  rollout_percentage INTEGER NOT NULL DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
  country_codes TEXT[] NOT NULL DEFAULT '{}',
  user_whitelist UUID[] NOT NULL DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.kyc_feature_flags TO authenticated;
GRANT ALL ON public.kyc_feature_flags TO service_role;
ALTER TABLE public.kyc_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_flags_admin_manage" ON public.kyc_feature_flags
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "feature_flags_read_authenticated" ON public.kyc_feature_flags
  FOR SELECT TO authenticated USING (true);

-- Seed flags DISABLED (Standing Order: changes nothing on deploy)
INSERT INTO public.kyc_feature_flags (flag_key, is_enabled, rollout_percentage, country_codes, description)
VALUES
  ('youverify.global', false, 0, ARRAY['CM','GA','CG','TD','CF','GQ'], 'Master Youverify on/off switch'),
  ('youverify.rollout', false, 0, '{}', 'Percentage of traffic routed to Youverify (0-100)'),
  ('youverify.countries', false, 0, ARRAY['CM','GA','CG','TD','CF','GQ'], 'Country allowlist for Youverify routing')
ON CONFLICT (flag_key) DO NOTHING;

-- Audit log for every verification attempt
CREATE TABLE IF NOT EXISTS public.kyc_verification_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id TEXT NOT NULL,
  user_id UUID,
  verification_type TEXT NOT NULL,
  provider_used TEXT NOT NULL CHECK (provider_used IN ('youverify','self_hosted')),
  fallback_triggered BOOLEAN NOT NULL DEFAULT false,
  fallback_reason TEXT,
  youverify_success BOOLEAN,
  self_hosted_success BOOLEAN,
  youverify_response_time_ms INTEGER,
  self_hosted_response_time_ms INTEGER,
  verification_result TEXT,
  risk_score INTEGER CHECK (risk_score IS NULL OR risk_score BETWEEN 0 AND 100),
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_audit_trace ON public.kyc_verification_audit(trace_id);
CREATE INDEX IF NOT EXISTS idx_kyc_audit_user ON public.kyc_verification_audit(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kyc_audit_provider ON public.kyc_verification_audit(provider_used, created_at DESC);

GRANT SELECT ON public.kyc_verification_audit TO authenticated;
GRANT ALL ON public.kyc_verification_audit TO service_role;
ALTER TABLE public.kyc_verification_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_user_read_own" ON public.kyc_verification_audit
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Circuit breaker state (single-row table, persisted across instances)
CREATE TABLE IF NOT EXISTS public.kyc_circuit_breaker_state (
  provider TEXT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'closed' CHECK (state IN ('closed','open','half_open')),
  failure_count INTEGER NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  opened_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.kyc_circuit_breaker_state TO authenticated;
GRANT ALL ON public.kyc_circuit_breaker_state TO service_role;
ALTER TABLE public.kyc_circuit_breaker_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "circuit_state_admin_read" ON public.kyc_circuit_breaker_state
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.kyc_circuit_breaker_state (provider, state) VALUES ('youverify','closed')
ON CONFLICT (provider) DO NOTHING;

-- Idempotency tracking for Youverify webhook deliveries
CREATE TABLE IF NOT EXISTS public.youverify_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  signature TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  discrepancy BOOLEAN NOT NULL DEFAULT false
);

GRANT ALL ON public.youverify_webhook_events TO service_role;
ALTER TABLE public.youverify_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_events_admin_read" ON public.youverify_webhook_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Add Youverify session linkage to existing verification tables (nullable, non-breaking)
ALTER TABLE public.kyc_verifications ADD COLUMN IF NOT EXISTS youverify_session_id TEXT;
ALTER TABLE public.business_kyc ADD COLUMN IF NOT EXISTS youverify_session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_kyc_verif_yv_session ON public.kyc_verifications(youverify_session_id) WHERE youverify_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_business_kyc_yv_session ON public.business_kyc(youverify_session_id) WHERE youverify_session_id IS NOT NULL;

-- updated_at trigger for feature flags
CREATE OR REPLACE FUNCTION public.kyc_flags_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_kyc_flags_touch ON public.kyc_feature_flags;
CREATE TRIGGER trg_kyc_flags_touch BEFORE UPDATE ON public.kyc_feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.kyc_flags_touch_updated_at();
