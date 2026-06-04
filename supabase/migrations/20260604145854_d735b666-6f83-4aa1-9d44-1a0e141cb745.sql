
-- Harden KYC gateway RBAC + add tunable circuit breaker thresholds + webhook timestamp tracking.

-- 1) Restrict feature flag visibility to admins only (was: any authenticated)
DROP POLICY IF EXISTS "feature_flags_read_authenticated" ON public.kyc_feature_flags;
DROP POLICY IF EXISTS "feature_flags_admin_read" ON public.kyc_feature_flags;
CREATE POLICY "feature_flags_admin_read" ON public.kyc_feature_flags
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) Restrict circuit breaker writes/inserts to admins via RLS (service_role bypasses RLS)
DROP POLICY IF EXISTS "circuit_state_admin_write" ON public.kyc_circuit_breaker_state;
CREATE POLICY "circuit_state_admin_write" ON public.kyc_circuit_breaker_state
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "circuit_state_admin_insert" ON public.kyc_circuit_breaker_state;
CREATE POLICY "circuit_state_admin_insert" ON public.kyc_circuit_breaker_state
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) Add tunable thresholds to circuit breaker (per-provider configuration)
ALTER TABLE public.kyc_circuit_breaker_state
  ADD COLUMN IF NOT EXISTS failure_threshold INTEGER NOT NULL DEFAULT 5
    CHECK (failure_threshold BETWEEN 1 AND 1000),
  ADD COLUMN IF NOT EXISTS min_samples INTEGER NOT NULL DEFAULT 10
    CHECK (min_samples BETWEEN 1 AND 10000),
  ADD COLUMN IF NOT EXISTS window_seconds INTEGER NOT NULL DEFAULT 30
    CHECK (window_seconds BETWEEN 5 AND 3600),
  ADD COLUMN IF NOT EXISTS cooldown_seconds INTEGER NOT NULL DEFAULT 60
    CHECK (cooldown_seconds BETWEEN 5 AND 86400);

-- 4) Webhook events: track timestamp/skew + idempotency outcomes
ALTER TABLE public.youverify_webhook_events
  ADD COLUMN IF NOT EXISTS event_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS skew_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS outcome TEXT
    CHECK (outcome IS NULL OR outcome IN (
      'processed','duplicate','stale','bad_signature','missing_timestamp',
      'discrepancy','no_session','session_not_found','applied','already_decided'
    )),
  ADD COLUMN IF NOT EXISTS outcome_detail TEXT;

CREATE INDEX IF NOT EXISTS idx_yv_webhook_outcome
  ON public.youverify_webhook_events(outcome, processed_at DESC);
