
-- Bill provider settlement accounts: supports multiple settlement methods per provider
-- Aligned with all KOB payment rails
CREATE TABLE public.bill_provider_settlement_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.bill_providers(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('bank_transfer', 'mobile_money', 'kang_wallet', 'paypal', 'card', 'rtgs_wire')),
  label TEXT, -- e.g. "Primary Bank", "MTN MoMo Backup"
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- Bank Transfer fields
  bank_name TEXT,
  bank_code TEXT,
  branch_code TEXT,
  account_number TEXT,
  account_name TEXT,
  swift_bic TEXT,
  -- Mobile Money fields
  momo_provider TEXT, -- mtn, orange, etc.
  momo_phone TEXT,
  momo_name TEXT,
  -- Kang Wallet fields
  wallet_account_id TEXT,
  wallet_user_id TEXT,
  -- PayPal fields
  paypal_email TEXT,
  paypal_merchant_id TEXT,
  -- Card (Visa Direct / MC Send) fields
  card_last4 TEXT,
  card_token TEXT,
  card_network TEXT, -- visa, mastercard
  -- RTGS / Wire fields
  rtgs_account_number TEXT,
  rtgs_bank_name TEXT,
  rtgs_swift_code TEXT,
  rtgs_routing_number TEXT,
  -- Percentage split (for multi-destination settlement)
  split_percentage NUMERIC(5,2) DEFAULT 100.00,
  -- Metadata & audit
  currency TEXT NOT NULL DEFAULT 'XAF',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_bpsa_provider ON public.bill_provider_settlement_accounts(provider_id);
CREATE INDEX idx_bpsa_method ON public.bill_provider_settlement_accounts(method);
CREATE INDEX idx_bpsa_active ON public.bill_provider_settlement_accounts(provider_id, is_active);

-- Ensure only one primary per provider
CREATE UNIQUE INDEX idx_bpsa_primary ON public.bill_provider_settlement_accounts(provider_id) WHERE is_primary = true AND is_active = true;

-- RLS
ALTER TABLE public.bill_provider_settlement_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on settlement accounts"
  ON public.bill_provider_settlement_accounts
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
