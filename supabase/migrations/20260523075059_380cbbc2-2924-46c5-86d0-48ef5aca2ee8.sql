
-- Savings Vault (one per consumer)
CREATE TABLE public.savings_vaults (
  consumer_id UUID PRIMARY KEY,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency TEXT NOT NULL DEFAULT 'XAF',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.savings_vaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select_savings_vault" ON public.savings_vaults
  FOR SELECT TO authenticated USING (auth.uid() = consumer_id);
CREATE POLICY "owner_insert_savings_vault" ON public.savings_vaults
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = consumer_id);
CREATE POLICY "owner_update_savings_vault" ON public.savings_vaults
  FOR UPDATE TO authenticated USING (auth.uid() = consumer_id);

CREATE TRIGGER update_savings_vaults_updated_at
  BEFORE UPDATE ON public.savings_vaults
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vault transactions (credits from roundups, debits for withdrawals)
CREATE TABLE public.vault_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('credit','debit')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  balance_after NUMERIC(14,2) NOT NULL,
  source TEXT,                    -- 'roundup' | 'manual' | 'withdrawal'
  source_ref UUID,                -- e.g. roundup_transaction id
  destination_kind TEXT CHECK (destination_kind IN ('wallet','bank')),
  destination_account_id UUID,
  description TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vault_tx_consumer_created
  ON public.vault_transactions (consumer_id, created_at DESC);

ALTER TABLE public.vault_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select_vault_tx" ON public.vault_transactions
  FOR SELECT TO authenticated USING (auth.uid() = consumer_id);
CREATE POLICY "owner_insert_vault_tx" ON public.vault_transactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = consumer_id);
