-- Add SOAP bank connector type
ALTER TYPE public.tenant_connector_id ADD VALUE IF NOT EXISTS 'soap_bank';

-- Polling queue for direct MTN/Orange rails
CREATE TABLE IF NOT EXISTS public.byo_charge_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id UUID,
  tenant_connector_id UUID REFERENCES public.tenant_payment_connectors(id) ON DELETE CASCADE,
  connector_id public.tenant_connector_id NOT NULL,
  provider_reference TEXT NOT NULL,
  owner_type public.tenant_connector_owner_type NOT NULL,
  owner_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','successful','failed','expired')),
  attempt_count INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 20,
  next_poll_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_polled_at TIMESTAMPTZ,
  last_error TEXT,
  terminal_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_byo_charge_polls_due
  ON public.byo_charge_polls (next_poll_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_byo_charge_polls_owner
  ON public.byo_charge_polls (owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_byo_charge_polls_provider_ref
  ON public.byo_charge_polls (provider_reference);

ALTER TABLE public.byo_charge_polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants view own poll rows"
  ON public.byo_charge_polls FOR SELECT TO authenticated
  USING (public.is_tenant_connector_owner(auth.uid(), owner_type, owner_id));

CREATE POLICY "Admins view all poll rows"
  ON public.byo_charge_polls FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages poll rows"
  ON public.byo_charge_polls FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Routing attempt trail for multi-rail failover debugging
CREATE TABLE IF NOT EXISTS public.byo_routing_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_reference TEXT NOT NULL,
  owner_type public.tenant_connector_owner_type NOT NULL,
  owner_id UUID NOT NULL,
  connector_id TEXT NOT NULL,
  tenant_connector_id UUID,
  attempt_index INT NOT NULL,
  success BOOLEAN NOT NULL,
  status TEXT,
  provider_reference TEXT,
  error_code TEXT,
  error_message TEXT,
  duration_ms INT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_byo_routing_attempts_ref
  ON public.byo_routing_attempts (charge_reference);
CREATE INDEX IF NOT EXISTS idx_byo_routing_attempts_owner
  ON public.byo_routing_attempts (owner_type, owner_id, attempted_at DESC);

ALTER TABLE public.byo_routing_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants view own routing attempts"
  ON public.byo_routing_attempts FOR SELECT TO authenticated
  USING (public.is_tenant_connector_owner(auth.uid(), owner_type, owner_id));

CREATE POLICY "Admins view all routing attempts"
  ON public.byo_routing_attempts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages routing attempts"
  ON public.byo_routing_attempts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Auto-update timestamp
CREATE TRIGGER update_byo_charge_polls_timestamp
  BEFORE UPDATE ON public.byo_charge_polls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();