
-- Gap 1: Add capture_mode and captured_amount to gateway_charges
ALTER TABLE public.gateway_charges
  ADD COLUMN IF NOT EXISTS capture_mode text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS captured_amount numeric;

-- Gap 6: Add fee_bearer to gateway_merchants
ALTER TABLE public.gateway_merchants
  ADD COLUMN IF NOT EXISTS fee_bearer text NOT NULL DEFAULT 'merchant';

-- Gap 2: Virtual Accounts table
CREATE TABLE IF NOT EXISTS public.gateway_virtual_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id uuid NOT NULL REFERENCES public.gateway_merchants(id),
  account_number text,
  bank_name text,
  provider_ref text,
  status text NOT NULL DEFAULT 'active',
  currency text NOT NULL DEFAULT 'NGN',
  email text,
  bvn text,
  expiry timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gateway_virtual_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own virtual accounts"
  ON public.gateway_virtual_accounts FOR ALL
  USING (merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid()));

-- Gap 7: Merchant Wallets table
CREATE TABLE IF NOT EXISTS public.gateway_merchant_wallets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id uuid NOT NULL REFERENCES public.gateway_merchants(id),
  currency text NOT NULL DEFAULT 'XAF',
  available_balance numeric NOT NULL DEFAULT 0,
  pending_balance numeric NOT NULL DEFAULT 0,
  ledger_balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(merchant_id, currency)
);

ALTER TABLE public.gateway_merchant_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own wallets"
  ON public.gateway_merchant_wallets FOR SELECT
  USING (merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid()));

-- Wallet update function
CREATE OR REPLACE FUNCTION public.update_merchant_wallet(
  _merchant_id uuid,
  _currency text,
  _available_delta numeric DEFAULT 0,
  _pending_delta numeric DEFAULT 0,
  _ledger_delta numeric DEFAULT 0
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.gateway_merchant_wallets (merchant_id, currency, available_balance, pending_balance, ledger_balance)
  VALUES (_merchant_id, _currency, GREATEST(_available_delta, 0), GREATEST(_pending_delta, 0), GREATEST(_ledger_delta, 0))
  ON CONFLICT (merchant_id, currency)
  DO UPDATE SET
    available_balance = gateway_merchant_wallets.available_balance + _available_delta,
    pending_balance = gateway_merchant_wallets.pending_balance + _pending_delta,
    ledger_balance = gateway_merchant_wallets.ledger_balance + _ledger_delta,
    updated_at = now();
END;
$$;
