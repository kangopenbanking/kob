-- Phase 8 production blockers: payment_intents canonical resource + sandbox tier

-- =====================================================
-- 1) payment_intents — rail-agnostic async payment intent
-- =====================================================
CREATE TABLE IF NOT EXISTS public.payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status TEXT NOT NULL DEFAULT 'requires_payment_method'
    CHECK (status IN (
      'requires_payment_method',
      'requires_confirmation',
      'processing',
      'requires_action',
      'succeeded',
      'canceled',
      'failed'
    )),
  payment_method_types TEXT[] NOT NULL DEFAULT '{}',
  next_action JSONB,
  last_error JSONB,
  idempotency_key TEXT,
  child_intent_id UUID,
  child_resource TEXT,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  customer_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  succeeded_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  UNIQUE (merchant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_merchant_status
  ON public.payment_intents(merchant_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_intents_created_at
  ON public.payment_intents(created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.payment_intents TO authenticated;
GRANT ALL ON public.payment_intents TO service_role;

ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;

-- Owning merchant (auth.uid() = merchant_id for direct dashboard users) can view
CREATE POLICY "Merchants view own payment intents"
  ON public.payment_intents FOR SELECT
  TO authenticated
  USING (merchant_id = auth.uid());

CREATE POLICY "Merchants create own payment intents"
  ON public.payment_intents FOR INSERT
  TO authenticated
  WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "Merchants update own payment intents"
  ON public.payment_intents FOR UPDATE
  TO authenticated
  USING (merchant_id = auth.uid());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.payment_intents_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.status = 'succeeded' AND OLD.status IS DISTINCT FROM 'succeeded' THEN
    NEW.succeeded_at = now();
  END IF;
  IF NEW.status = 'canceled' AND OLD.status IS DISTINCT FROM 'canceled' THEN
    NEW.canceled_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_intents_touch ON public.payment_intents;
CREATE TRIGGER trg_payment_intents_touch
  BEFORE UPDATE ON public.payment_intents
  FOR EACH ROW EXECUTE FUNCTION public.payment_intents_touch_updated_at();

-- =====================================================
-- 2) sandbox_api_keys: add tier column (idempotent)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sandbox_api_keys') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'sandbox_api_keys' AND column_name = 'tier'
    ) THEN
      ALTER TABLE public.sandbox_api_keys
        ADD COLUMN tier TEXT NOT NULL DEFAULT 'free'
          CHECK (tier IN ('free', 'pro', 'enterprise'));
    END IF;
  END IF;
END $$;