-- Add per-merchant settlement cycle (default daily; instant is opt-in)
ALTER TABLE public.gateway_merchants
  ADD COLUMN IF NOT EXISTS settlement_frequency text NOT NULL DEFAULT 'daily';

-- Constrain to known values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name='gateway_merchants' AND constraint_name='gateway_merchants_settlement_frequency_chk'
  ) THEN
    ALTER TABLE public.gateway_merchants
      ADD CONSTRAINT gateway_merchants_settlement_frequency_chk
      CHECK (settlement_frequency IN ('instant','daily','weekly','monthly'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_gateway_merchants_settlement_frequency
  ON public.gateway_merchants (settlement_frequency)
  WHERE settlement_frequency = 'instant';

-- Track last instant settlement to make the per-minute job idempotent
ALTER TABLE public.gateway_merchant_wallets
  ADD COLUMN IF NOT EXISTS last_instant_settled_at timestamptz;

-- Allow the institutions cron to also recognise 'instant'
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='institutions_settlement_frequency_chk') THEN
    ALTER TABLE public.institutions DROP CONSTRAINT institutions_settlement_frequency_chk;
  END IF;
  ALTER TABLE public.institutions
    ADD CONSTRAINT institutions_settlement_frequency_chk
    CHECK (settlement_frequency IS NULL OR settlement_frequency IN ('instant','daily','weekly','monthly'));
END$$;