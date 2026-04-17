
-- Wave 5: Bank operations retry queue + staging tables

-- Retry queue for failed bank operations
CREATE TABLE IF NOT EXISTS public.bank_retry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  config_id UUID REFERENCES public.bank_connector_configs(id) ON DELETE SET NULL,
  operation TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  last_attempt_at TIMESTAMPTZ,
  dead_lettered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bank_retry_queue_status_check CHECK (status IN ('pending','processing','completed','failed','dead_letter'))
);

CREATE INDEX IF NOT EXISTS idx_bank_retry_queue_due
  ON public.bank_retry_queue (next_attempt_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_bank_retry_queue_bank ON public.bank_retry_queue (bank_id, status);

ALTER TABLE public.bank_retry_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage bank retry queue"
  ON public.bank_retry_queue FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Staged bank-side transactions used by polling + reconciliation
CREATE TABLE IF NOT EXISTS public.bank_side_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  config_id UUID REFERENCES public.bank_connector_configs(id) ON DELETE SET NULL,
  external_account_id TEXT NOT NULL,
  external_tx_id TEXT NOT NULL,
  booking_date DATE,
  value_date DATE,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  credit_debit TEXT NOT NULL,
  reference TEXT,
  description TEXT,
  raw JSONB,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bank_side_tx_unique UNIQUE (bank_id, external_account_id, external_tx_id)
);

CREATE INDEX IF NOT EXISTS idx_bank_side_tx_lookup
  ON public.bank_side_transactions (bank_id, booking_date);

ALTER TABLE public.bank_side_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read bank-side transactions"
  ON public.bank_side_transactions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages bank-side transactions"
  ON public.bank_side_transactions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Snapshot of bank-side balances per polled account
CREATE TABLE IF NOT EXISTS public.bank_side_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  config_id UUID REFERENCES public.bank_connector_configs(id) ON DELETE SET NULL,
  external_account_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  balance_type TEXT NOT NULL DEFAULT 'ClosingAvailable',
  as_of_datetime TIMESTAMPTZ NOT NULL,
  raw JSONB,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_side_bal_lookup
  ON public.bank_side_balances (bank_id, external_account_id, recorded_at DESC);

ALTER TABLE public.bank_side_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read bank-side balances"
  ON public.bank_side_balances FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger for retry queue
CREATE TRIGGER update_bank_retry_queue_updated_at
  BEFORE UPDATE ON public.bank_retry_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
