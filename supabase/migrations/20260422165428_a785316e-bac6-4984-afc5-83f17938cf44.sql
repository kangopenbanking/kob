CREATE TABLE IF NOT EXISTS public.integration_idempotency_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  idempotency_key TEXT NOT NULL,
  merchant_id UUID,
  resource TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER,
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  CONSTRAINT integration_idempotency_unique UNIQUE (merchant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_integration_idempotency_lookup
  ON public.integration_idempotency_keys (merchant_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_integration_idempotency_expires
  ON public.integration_idempotency_keys (expires_at);

ALTER TABLE public.integration_idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants view own idempotency keys"
  ON public.integration_idempotency_keys FOR SELECT
  USING (merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid()));

CREATE POLICY "Service role manages idempotency keys"
  ON public.integration_idempotency_keys FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE TABLE IF NOT EXISTS public.integration_webhook_replays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_event_id UUID NOT NULL,
  merchant_id UUID,
  replayed_by UUID,
  replay_status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_replays_event
  ON public.integration_webhook_replays (original_event_id);
CREATE INDEX IF NOT EXISTS idx_integration_replays_merchant
  ON public.integration_webhook_replays (merchant_id);

ALTER TABLE public.integration_webhook_replays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants view own replays"
  ON public.integration_webhook_replays FOR SELECT
  USING (merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid()));

CREATE POLICY "Admins view all replays"
  ON public.integration_webhook_replays FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages replays"
  ON public.integration_webhook_replays FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');