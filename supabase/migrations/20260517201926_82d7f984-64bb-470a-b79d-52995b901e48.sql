CREATE TABLE IF NOT EXISTS public.charge_dlq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id UUID,
  merchant_id UUID,
  provider TEXT,
  last_error JSONB,
  attempts INTEGER NOT NULL DEFAULT 0,
  trace_id TEXT,
  replayed_at TIMESTAMPTZ,
  replayed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_charge_dlq_created    ON public.charge_dlq(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_charge_dlq_merchant   ON public.charge_dlq(merchant_id);
CREATE INDEX IF NOT EXISTS idx_charge_dlq_unplayed   ON public.charge_dlq(replayed_at) WHERE replayed_at IS NULL;

ALTER TABLE public.charge_dlq ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read charge_dlq"
  ON public.charge_dlq FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update charge_dlq"
  ON public.charge_dlq FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- 24h idempotency replay cache (Phase 4 — extends existing 60s in-flight reservation)
CREATE TABLE IF NOT EXISTS public.idempotency_cache_extended (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL,
  merchant_id UUID NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER,
  response_body JSONB,
  trace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  UNIQUE (merchant_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_idem_ext_expires ON public.idempotency_cache_extended(expires_at);

ALTER TABLE public.idempotency_cache_extended ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read idem cache"
  ON public.idempotency_cache_extended FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));