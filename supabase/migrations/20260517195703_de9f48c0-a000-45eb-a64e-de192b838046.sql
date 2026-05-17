
-- Phase 2 — AuthZ scopes + webhook circuit breaker (additive)

-- 1. API key scope matrix
CREATE TABLE IF NOT EXISTS public.api_key_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL,
  scope TEXT NOT NULL,
  granted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (api_key_id, scope)
);

CREATE INDEX IF NOT EXISTS idx_api_key_scopes_key ON public.api_key_scopes(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_scopes_scope ON public.api_key_scopes(scope);

ALTER TABLE public.api_key_scopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage api_key_scopes"
ON public.api_key_scopes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Webhook endpoint health / circuit breaker
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'webhook_circuit_state') THEN
    CREATE TYPE public.webhook_circuit_state AS ENUM ('closed', 'half_open', 'open');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.webhook_endpoint_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL UNIQUE,
  merchant_id UUID,
  circuit_state public.webhook_circuit_state NOT NULL DEFAULT 'closed',
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  rolling_failure_count INTEGER NOT NULL DEFAULT 0,
  rolling_window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  open_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_health_endpoint ON public.webhook_endpoint_health(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_webhook_health_merchant ON public.webhook_endpoint_health(merchant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_health_state ON public.webhook_endpoint_health(circuit_state) WHERE circuit_state <> 'closed';

ALTER TABLE public.webhook_endpoint_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read webhook_endpoint_health"
ON public.webhook_endpoint_health
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage webhook_endpoint_health"
ON public.webhook_endpoint_health
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Merchants can read health of their own endpoints
CREATE POLICY "Merchants read own endpoint health"
ON public.webhook_endpoint_health
FOR SELECT
TO authenticated
USING (
  merchant_id IS NOT NULL
  AND merchant_id IN (
    SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid()
  )
);

-- Updated_at trigger reuses existing helper if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    EXECUTE 'CREATE TRIGGER trg_webhook_endpoint_health_updated
             BEFORE UPDATE ON public.webhook_endpoint_health
             FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;
