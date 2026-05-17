
CREATE TABLE IF NOT EXISTS public.risk_blocklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('msisdn','email','iban','device_id','ip')),
  identifier_value TEXT NOT NULL,
  reason TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  source TEXT NOT NULL DEFAULT 'manual',
  added_by UUID,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (identifier_type, identifier_value)
);
CREATE INDEX IF NOT EXISTS idx_risk_blocklists_lookup ON public.risk_blocklists (identifier_type, identifier_value) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_risk_blocklists_expiry ON public.risk_blocklists (expires_at) WHERE expires_at IS NOT NULL;
ALTER TABLE public.risk_blocklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage risk blocklists" ON public.risk_blocklists FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.merchant_risk_baselines (
  merchant_id UUID PRIMARY KEY,
  window_days INTEGER NOT NULL DEFAULT 30,
  charge_count BIGINT NOT NULL DEFAULT 0,
  avg_amount NUMERIC(20,2) NOT NULL DEFAULT 0,
  p95_amount NUMERIC(20,2) NOT NULL DEFAULT 0,
  max_amount NUMERIC(20,2) NOT NULL DEFAULT 0,
  decline_rate NUMERIC(6,4) NOT NULL DEFAULT 0,
  distinct_customers BIGINT NOT NULL DEFAULT 0,
  top_currencies JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_merchant_risk_baselines_recompute ON public.merchant_risk_baselines (last_computed_at);
ALTER TABLE public.merchant_risk_baselines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read merchant risk baselines" ON public.merchant_risk_baselines FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.kv_cache (
  cache_key TEXT PRIMARY KEY,
  cache_value JSONB NOT NULL,
  namespace TEXT NOT NULL DEFAULT 'default',
  expires_at TIMESTAMPTZ NOT NULL,
  hit_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kv_cache_expiry ON public.kv_cache (expires_at);
CREATE INDEX IF NOT EXISTS idx_kv_cache_namespace ON public.kv_cache (namespace);
ALTER TABLE public.kv_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage kv cache" ON public.kv_cache FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS trg_risk_blocklists_updated ON public.risk_blocklists;
    CREATE TRIGGER trg_risk_blocklists_updated BEFORE UPDATE ON public.risk_blocklists
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    DROP TRIGGER IF EXISTS trg_merchant_risk_baselines_updated ON public.merchant_risk_baselines;
    CREATE TRIGGER trg_merchant_risk_baselines_updated BEFORE UPDATE ON public.merchant_risk_baselines
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    DROP TRIGGER IF EXISTS trg_kv_cache_updated ON public.kv_cache;
    CREATE TRIGGER trg_kv_cache_updated BEFORE UPDATE ON public.kv_cache
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

INSERT INTO public.system_config (key, value, description, category)
VALUES
  ('risk_fail_closed_enabled', 'false'::jsonb, 'Phase 7 — when true, risk-score fails closed for high-value transactions above threshold.', 'risk'),
  ('risk_fail_closed_threshold_xaf', '1000000'::jsonb, 'Phase 7 — XAF threshold above which risk-score is fail-closed when enabled.', 'risk')
ON CONFLICT (key) DO NOTHING;
