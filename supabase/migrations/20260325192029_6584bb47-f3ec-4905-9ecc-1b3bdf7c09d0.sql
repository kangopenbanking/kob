
-- Remittance Pay-in Intents
CREATE TABLE public.remittance_payin_intents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  remittance_id UUID REFERENCES public.remittances(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'paypal', 'flutterwave', 'kob_wallet')),
  provider_ref TEXT,
  method TEXT NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'cancelled')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_remittance_payin_intents_remittance ON public.remittance_payin_intents(remittance_id);
CREATE INDEX idx_remittance_payin_intents_provider_ref ON public.remittance_payin_intents(provider, provider_ref);

ALTER TABLE public.remittance_payin_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only for remittance_payin_intents" ON public.remittance_payin_intents FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Remittance Client Webhook Endpoints
CREATE TABLE public.remittance_client_webhook_endpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  secret_hash TEXT NOT NULL,
  secret_last_four TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rcwe_client ON public.remittance_client_webhook_endpoints(client_id);

ALTER TABLE public.remittance_client_webhook_endpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only for rcwe" ON public.remittance_client_webhook_endpoints FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Remittance Client Webhook Deliveries
CREATE TABLE public.remittance_client_webhook_deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint_id UUID REFERENCES public.remittance_client_webhook_endpoints(id) ON DELETE CASCADE NOT NULL,
  remittance_id UUID REFERENCES public.remittances(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  http_status INT,
  attempt_count INT NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rcwd_endpoint ON public.remittance_client_webhook_deliveries(endpoint_id);
CREATE INDEX idx_rcwd_remittance ON public.remittance_client_webhook_deliveries(remittance_id);

ALTER TABLE public.remittance_client_webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only for rcwd" ON public.remittance_client_webhook_deliveries FOR ALL TO service_role USING (true) WITH CHECK (true);
