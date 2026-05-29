-- Phase 11: integrator experience & governance

-- 1. Webhook delivery: flag for synthetic test events
ALTER TABLE public.gateway_webhook_deliveries
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

ALTER TABLE public.gateway_webhook_deliveries_v2
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_gw_deliveries_is_test
  ON public.gateway_webhook_deliveries (is_test) WHERE is_test = true;

-- 2. API key lifecycle: status enum-like text + suspended_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'gateway_merchant_api_keys' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.gateway_merchant_api_keys
      ADD COLUMN status text NOT NULL DEFAULT 'active'
      CHECK (status IN ('active','suspended','revoked'));
  END IF;
END $$;

ALTER TABLE public.gateway_merchant_api_keys
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_reason text;

CREATE INDEX IF NOT EXISTS idx_gw_api_keys_status
  ON public.gateway_merchant_api_keys (status);
