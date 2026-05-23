
-- Extend credit_event_type enum
ALTER TYPE public.credit_event_type ADD VALUE IF NOT EXISTS 'SAVINGS_ROUNDUP';

-- Roundup transactions: source attribution
ALTER TABLE public.roundup_transactions
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'wallet',
  ADD COLUMN IF NOT EXISTS source_account_id uuid,
  ADD COLUMN IF NOT EXISTS bank_id uuid,
  ADD COLUMN IF NOT EXISTS merchant_name text,
  ADD COLUMN IF NOT EXISTS credit_event_id uuid;

ALTER TABLE public.roundup_transactions
  DROP CONSTRAINT IF EXISTS roundup_transactions_source_kind_check;
ALTER TABLE public.roundup_transactions
  ADD CONSTRAINT roundup_transactions_source_kind_check
  CHECK (source_kind IN ('wallet','bank','manual'));

CREATE INDEX IF NOT EXISTS idx_roundup_tx_consumer_created
  ON public.roundup_transactions (consumer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_roundup_tx_source
  ON public.roundup_transactions (source_kind, source_account_id);

-- Roundup settings: source filter + credit boost opt-in
ALTER TABLE public.roundup_settings
  ADD COLUMN IF NOT EXISTS source_filter text NOT NULL DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS credit_boost_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.roundup_settings
  DROP CONSTRAINT IF EXISTS roundup_settings_source_filter_check;
ALTER TABLE public.roundup_settings
  ADD CONSTRAINT roundup_settings_source_filter_check
  CHECK (source_filter IN ('wallet','bank','both'));
