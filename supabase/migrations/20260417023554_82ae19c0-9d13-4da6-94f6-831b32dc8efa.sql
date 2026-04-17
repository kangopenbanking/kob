-- Wave 1: Unified Bank Connector Configuration
-- Additive only. No changes to existing tables.

CREATE TABLE IF NOT EXISTS public.bank_connector_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  adapter_type TEXT NOT NULL CHECK (adapter_type IN ('rest', 'sql', 'file', 'soap')),
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'live')),
  display_name TEXT NOT NULL,
  credentials_encrypted JSONB NOT NULL DEFAULT '{}'::jsonb,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  polling_interval_seconds INTEGER NOT NULL DEFAULT 300 CHECK (polling_interval_seconds >= 30),
  last_sync_watermark TEXT,
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_error TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  priority INTEGER NOT NULL DEFAULT 100,
  health_status TEXT NOT NULL DEFAULT 'unknown' CHECK (health_status IN ('unknown','healthy','degraded','down')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bcc_bank_priority
  ON public.bank_connector_configs(bank_id, enabled, priority);

CREATE INDEX IF NOT EXISTS idx_bcc_adapter_type
  ON public.bank_connector_configs(adapter_type, enabled);

ALTER TABLE public.bank_connector_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all bank connector configs"
  ON public.bank_connector_configs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access bank connector configs"
  ON public.bank_connector_configs FOR ALL
  USING (auth.role() = 'service_role');

CREATE TRIGGER update_bcc_updated_at
  BEFORE UPDATE ON public.bank_connector_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Adapter execution attempt trail (mirrors byo_routing_attempts pattern)
CREATE TABLE IF NOT EXISTS public.bank_connector_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES public.bank_connector_configs(id) ON DELETE CASCADE,
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  correlation_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('success','failed','timeout')),
  latency_ms INTEGER,
  error_message TEXT,
  request_meta JSONB DEFAULT '{}'::jsonb,
  response_meta JSONB DEFAULT '{}'::jsonb,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bca_config ON public.bank_connector_attempts(config_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_bca_bank_op ON public.bank_connector_attempts(bank_id, operation, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_bca_correlation ON public.bank_connector_attempts(correlation_id) WHERE correlation_id IS NOT NULL;

ALTER TABLE public.bank_connector_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read bank connector attempts"
  ON public.bank_connector_attempts FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access bank connector attempts"
  ON public.bank_connector_attempts FOR ALL
  USING (auth.role() = 'service_role');