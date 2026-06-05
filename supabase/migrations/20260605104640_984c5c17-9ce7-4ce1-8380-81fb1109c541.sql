
-- =========================================================
-- Phase 1: Nium Global Virtual Accounts foundation
-- =========================================================

-- 1) Extend profiles with payout preferences
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payout_preference TEXT NOT NULL DEFAULT 'KANG_WALLET',
  ADD COLUMN IF NOT EXISTS payout_channel TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_payout_preference_check') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_payout_preference_check
      CHECK (payout_preference IN ('KANG_WALLET','MOBILE_MONEY'));
  END IF;
END $$;

-- 2) Extend fee_structures transaction_type allowed values (additive only)
ALTER TABLE public.fee_structures DROP CONSTRAINT IF EXISTS fee_structures_transaction_type_check;
ALTER TABLE public.fee_structures
  ADD CONSTRAINT fee_structures_transaction_type_check
  CHECK (transaction_type = ANY (ARRAY[
    'transfer','payment','bill_payment','mobile_money_transfer','mobile_money_charge',
    'withdrawal','deposit','piggybank','njangi','rent','international_transfer',
    'card_payment','p2p','cashout','bank_transfer','intra_bank_transfer','inter_bank_transfer',
    'ussd_payment','account_funding','paypal_payment','virtual_card_topup','gateway_charge',
    'gateway_payout','fx_conversion','api_request','qr_payment','loan_disbursement','loan_repayment',
    'savings_deposit','savings_withdrawal','njangi_contribution','njangi_payout','piggybank_deposit',
    'piggybank_withdrawal','rent_payment','escrow_payment','mobile_recharge','invoice_create',
    'credit_report_purchase','overdraft_fee','loan_processing_fee','atm_withdrawal','standing_order',
    'dormancy_fee','remittance_inbound','remittance_outbound','remittance_bank_credit',
    'remittance_wallet_credit','remittance_bill_payment','remittance_fx_markup','overdraft_interest',
    'overdraft_setup_fee','overdraft_renewal_fee','byo_mobile_money_routing','byo_fallback_charge',
    'credit_score_inquiry','credit_report_inquiry','credit_premium_subscription','travel_booking',
    'travel_cancellation_fee','hotel_booking','flight_booking','tour_booking','woocommerce_transaction',
    'enterprise_subscription_starter','enterprise_subscription_growth','enterprise_subscription_scale',
    'statement_download_consumer','statement_download_banking',
    'nium_withdrawal','nium_fx_spread'
  ]));

-- Seed platform defaults (only if missing)
INSERT INTO public.fee_structures (transaction_type, fee_model, fixed_amount, percentage_rate, min_fee_amount, fee_scope)
SELECT 'nium_withdrawal','hybrid',100,0.0100,200,'platform'
WHERE NOT EXISTS (
  SELECT 1 FROM public.fee_structures
  WHERE transaction_type='nium_withdrawal' AND fee_scope='platform' AND is_active=true
);

INSERT INTO public.fee_structures (transaction_type, fee_model, fixed_amount, percentage_rate, min_fee_amount, fee_scope)
SELECT 'nium_fx_spread','percentage',0,0.0075,0,'platform'
WHERE NOT EXISTS (
  SELECT 1 FROM public.fee_structures
  WHERE transaction_type='nium_fx_spread' AND fee_scope='platform' AND is_active=true
);

-- 3) nium_global_accounts
CREATE TABLE IF NOT EXISTS public.nium_global_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nium_customer_hash_id TEXT,
  nium_account_id TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('USD','EUR','GBP')),
  iban TEXT,
  account_number TEXT,
  routing_code TEXT,
  bic TEXT,
  bank_name TEXT,
  bank_address TEXT,
  beneficiary_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','closed')),
  payout_preference_override TEXT CHECK (payout_preference_override IN ('KANG_WALLET','MOBILE_MONEY')),
  payout_channel_override TEXT,
  mode TEXT NOT NULL DEFAULT 'stub' CHECK (mode IN ('stub','sandbox','live')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (nium_account_id)
);

CREATE INDEX IF NOT EXISTS idx_nium_global_accounts_user ON public.nium_global_accounts(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nium_global_accounts TO authenticated;
GRANT ALL ON public.nium_global_accounts TO service_role;

ALTER TABLE public.nium_global_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own nium accounts" ON public.nium_global_accounts
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users insert own nium accounts" ON public.nium_global_accounts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own nium accounts" ON public.nium_global_accounts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4) nium_incoming_payments
CREATE TABLE IF NOT EXISTS public.nium_incoming_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nium_transaction_id TEXT NOT NULL UNIQUE,
  global_account_id UUID NOT NULL REFERENCES public.nium_global_accounts(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_amount NUMERIC(18,4) NOT NULL,
  source_currency TEXT NOT NULL,
  fx_rate_nium NUMERIC(18,8) NOT NULL,
  fx_spread_bps INTEGER NOT NULL DEFAULT 75,
  xaf_gross NUMERIC(18,2) NOT NULL,
  xaf_spread_revenue NUMERIC(18,2) NOT NULL DEFAULT 0,
  xaf_withdrawal_fee NUMERIC(18,2) NOT NULL DEFAULT 0,
  xaf_net_credited NUMERIC(18,2) NOT NULL,
  routing TEXT NOT NULL CHECK (routing IN ('KANG_WALLET','MOBILE_MONEY')),
  payout_channel TEXT,
  flutterwave_payout_id TEXT,
  ledger_tx_ref TEXT,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received','credited','payout_pending','payout_completed','payout_failed','failed')),
  failure_reason TEXT,
  raw_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nium_incoming_user ON public.nium_incoming_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_nium_incoming_status ON public.nium_incoming_payments(status);

GRANT SELECT ON public.nium_incoming_payments TO authenticated;
GRANT ALL ON public.nium_incoming_payments TO service_role;

ALTER TABLE public.nium_incoming_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own nium payments" ON public.nium_incoming_payments
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- 5) Updated-at triggers
CREATE OR REPLACE FUNCTION public.tg_nium_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS nium_ga_set_updated_at ON public.nium_global_accounts;
CREATE TRIGGER nium_ga_set_updated_at BEFORE UPDATE ON public.nium_global_accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_nium_set_updated_at();

DROP TRIGGER IF EXISTS nium_ip_set_updated_at ON public.nium_incoming_payments;
CREATE TRIGGER nium_ip_set_updated_at BEFORE UPDATE ON public.nium_incoming_payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_nium_set_updated_at();

-- 6) Helper: resolve effective routing for a Nium account
CREATE OR REPLACE FUNCTION public.resolve_nium_routing(_account_id UUID)
RETURNS TABLE(routing TEXT, channel TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE(ga.payout_preference_override, p.payout_preference, 'KANG_WALLET') AS routing,
    COALESCE(ga.payout_channel_override, p.payout_channel)                       AS channel
  FROM public.nium_global_accounts ga
  LEFT JOIN public.profiles p ON p.id = ga.user_id
  WHERE ga.id = _account_id
  LIMIT 1;
$$;
