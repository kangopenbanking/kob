
-- =============================================
-- Phase 7: Webhook v2 + SLA Monitoring Tables
-- =============================================

-- 1. Webhook Endpoints v2 (multiple endpoints per merchant)
CREATE TABLE public.gateway_webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  description TEXT,
  secret TEXT NOT NULL,
  secret_hash TEXT,
  events TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup
CREATE INDEX idx_webhook_endpoints_merchant ON public.gateway_webhook_endpoints(merchant_id);
CREATE INDEX idx_webhook_endpoints_active ON public.gateway_webhook_endpoints(merchant_id, is_active) WHERE is_active = true;

-- Auto-hash secret
CREATE OR REPLACE FUNCTION public.auto_hash_webhook_endpoint_secret()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NEW.secret IS NOT NULL THEN
    NEW.secret_hash = public.hash_secret_value(NEW.secret);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_hash_webhook_endpoint_secret
  BEFORE INSERT OR UPDATE ON public.gateway_webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.auto_hash_webhook_endpoint_secret();

-- Update timestamp trigger
CREATE TRIGGER trg_update_webhook_endpoint_ts
  BEFORE UPDATE ON public.gateway_webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.update_settlement_updated_at();

-- Webhook delivery log v2 (per-endpoint)
CREATE TABLE public.gateway_webhook_deliveries_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL REFERENCES public.gateway_webhook_endpoints(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  attempt INTEGER NOT NULL DEFAULT 1,
  max_attempts INTEGER NOT NULL DEFAULT 7,
  next_retry_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, delivered, failed, exhausted
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_deliveries_v2_endpoint ON public.gateway_webhook_deliveries_v2(endpoint_id);
CREATE INDEX idx_webhook_deliveries_v2_status ON public.gateway_webhook_deliveries_v2(status) WHERE status IN ('pending', 'failed');
CREATE INDEX idx_webhook_deliveries_v2_merchant ON public.gateway_webhook_deliveries_v2(merchant_id);

-- 2. SLA Metrics table
CREATE TABLE public.sla_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  check_type TEXT NOT NULL DEFAULT 'availability', -- availability, latency, error_rate
  status TEXT NOT NULL DEFAULT 'healthy', -- healthy, degraded, down
  response_time_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sla_metrics_service ON public.sla_metrics(service_name, checked_at DESC);
CREATE INDEX idx_sla_metrics_status ON public.sla_metrics(status) WHERE status != 'healthy';

-- SLA Incidents table
CREATE TABLE public.sla_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'minor', -- minor, major, critical
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'investigating', -- investigating, identified, monitoring, resolved
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sla_incidents_status ON public.sla_incidents(status) WHERE status != 'resolved';
CREATE INDEX idx_sla_incidents_service ON public.sla_incidents(service_name, started_at DESC);

-- 3. Payout sandbox simulation config
CREATE TABLE public.sandbox_payout_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_name TEXT NOT NULL UNIQUE,
  description TEXT,
  simulated_status TEXT NOT NULL DEFAULT 'successful', -- successful, failed, pending, reversed
  delay_seconds INTEGER NOT NULL DEFAULT 0,
  failure_reason TEXT,
  trigger_webhook BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default scenarios
INSERT INTO public.sandbox_payout_scenarios (scenario_name, description, simulated_status, delay_seconds, failure_reason, trigger_webhook) VALUES
  ('instant_success', 'Payout succeeds immediately', 'successful', 0, NULL, true),
  ('delayed_success', 'Payout succeeds after 30s processing delay', 'successful', 30, NULL, true),
  ('insufficient_funds', 'Payout fails due to insufficient provider funds', 'failed', 5, 'INSUFFICIENT_FUNDS: Provider balance too low', true),
  ('invalid_account', 'Payout fails due to invalid beneficiary account', 'failed', 3, 'INVALID_ACCOUNT: Beneficiary account not found or inactive', true),
  ('network_timeout', 'Payout fails due to provider network timeout', 'failed', 60, 'NETWORK_TIMEOUT: Provider did not respond within SLA', true),
  ('compliance_hold', 'Payout held for compliance review', 'pending', 0, 'COMPLIANCE_HOLD: Transaction flagged for manual review', false),
  ('reversed_after_success', 'Payout succeeds then gets reversed', 'reversed', 10, 'REVERSED: Beneficiary bank returned funds', true);

-- RLS
ALTER TABLE public.gateway_webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gateway_webhook_deliveries_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sandbox_payout_scenarios ENABLE ROW LEVEL SECURITY;

-- Webhook endpoints: merchant owns their endpoints
CREATE POLICY "Merchants manage own webhook endpoints"
  ON public.gateway_webhook_endpoints FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.gateway_merchants gm WHERE gm.id = merchant_id AND gm.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.gateway_merchants gm WHERE gm.id = merchant_id AND gm.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Webhook deliveries v2: merchant sees own deliveries
CREATE POLICY "Merchants view own webhook deliveries"
  ON public.gateway_webhook_deliveries_v2 FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.gateway_merchants gm WHERE gm.id = merchant_id AND gm.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Service role insert for deliveries
CREATE POLICY "Service role manages deliveries"
  ON public.gateway_webhook_deliveries_v2 FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- SLA metrics: admin read, service_role write
CREATE POLICY "Admins view SLA metrics"
  ON public.sla_metrics FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages SLA metrics"
  ON public.sla_metrics FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- SLA incidents: admin manage
CREATE POLICY "Admins manage SLA incidents"
  ON public.sla_incidents FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Sandbox scenarios: anyone can read, admin can manage
CREATE POLICY "Anyone reads sandbox scenarios"
  ON public.sandbox_payout_scenarios FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage sandbox scenarios"
  ON public.sandbox_payout_scenarios FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
