-- Phase 3: AISP Resource Server - Account Information
-- Tables for account data aligned with UK Open Banking v4.0

-- Account types and subtypes
CREATE TYPE account_type AS ENUM ('Business', 'Personal');
CREATE TYPE account_subtype AS ENUM ('Current', 'Savings', 'CreditCard', 'Loan');
CREATE TYPE account_scheme AS ENUM ('LOCAL_BANK', 'MOMO', 'IBAN');

-- 1. Accounts table
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL UNIQUE, -- External account identifier
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
  
  -- Account details
  currency TEXT NOT NULL DEFAULT 'XAF',
  account_type account_type NOT NULL DEFAULT 'Personal',
  account_subtype account_subtype NOT NULL DEFAULT 'Current',
  nickname TEXT,
  
  -- Account identification
  identification_scheme account_scheme NOT NULL DEFAULT 'LOCAL_BANK',
  identification_value TEXT NOT NULL, -- Account number
  secondary_identification TEXT, -- Sort code, branch code, etc.
  
  -- Account holder
  account_holder_name TEXT NOT NULL,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  opened_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Account Balances
CREATE TABLE public.account_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  -- Balance types (UK OB standard)
  balance_type TEXT NOT NULL, -- InterimAvailable, InterimBooked, Expected, OpeningAvailable, etc.
  credit_debit_indicator TEXT NOT NULL CHECK (credit_debit_indicator IN ('Credit', 'Debit')),
  
  -- Amount
  amount NUMERIC(15, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  
  -- Date/time
  balance_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Credit line (optional)
  credit_line JSONB, -- { "Included": true, "Amount": {...}, "Type": "Pre-Agreed" }
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(account_id, balance_type, balance_datetime)
);

-- 3. Beneficiaries (payees)
CREATE TABLE public.beneficiaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Beneficiary details
  beneficiary_name TEXT NOT NULL,
  reference TEXT,
  
  -- Account identification
  identification_scheme account_scheme NOT NULL,
  identification_value TEXT NOT NULL,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Standing Orders (recurring payments)
CREATE TABLE public.standing_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standing_order_id TEXT NOT NULL UNIQUE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Frequency
  frequency TEXT NOT NULL, -- EvryDay, EvryWorkgDay, IntrvlWkDay:1:1, WkInMnthDay:1:1, etc.
  reference TEXT,
  
  -- First and next payment
  first_payment_date DATE NOT NULL,
  next_payment_date DATE,
  final_payment_date DATE,
  
  -- Amount
  first_payment_amount NUMERIC(15, 2) NOT NULL,
  next_payment_amount NUMERIC(15, 2),
  final_payment_amount NUMERIC(15, 2),
  currency TEXT NOT NULL DEFAULT 'XAF',
  
  -- Creditor
  creditor_name TEXT NOT NULL,
  creditor_identification_scheme account_scheme NOT NULL,
  creditor_identification_value TEXT NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'Active', -- Active, Inactive
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Direct Debits (mandates)
CREATE TABLE public.direct_debits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direct_debit_id TEXT NOT NULL UNIQUE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Mandate details
  mandate_identification TEXT NOT NULL,
  direct_debit_status TEXT NOT NULL DEFAULT 'Active', -- Active, Inactive
  
  -- Creditor (merchant)
  name TEXT NOT NULL, -- Merchant name
  identification_scheme TEXT,
  identification_value TEXT,
  
  -- Previous payment
  previous_payment_date DATE,
  previous_payment_amount NUMERIC(15, 2),
  currency TEXT NOT NULL DEFAULT 'XAF',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update existing transactions table to link to accounts
ALTER TABLE public.transactions
  ADD COLUMN account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  ADD COLUMN booking_datetime TIMESTAMP WITH TIME ZONE,
  ADD COLUMN value_datetime TIMESTAMP WITH TIME ZONE,
  ADD COLUMN credit_debit_indicator TEXT CHECK (credit_debit_indicator IN ('Credit', 'Debit')),
  ADD COLUMN transaction_information TEXT,
  ADD COLUMN balance_after JSONB, -- { "amount": "...", "credit_debit_indicator": "..." }
  ADD COLUMN merchant_details JSONB, -- { "name": "...", "category_code": "..." }
  ADD COLUMN creditor_account JSONB,
  ADD COLUMN debtor_account JSONB;

-- Enable RLS
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standing_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_debits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for accounts
CREATE POLICY "Users can view own accounts"
  ON public.accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own accounts"
  ON public.accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts"
  ON public.accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all accounts"
  ON public.accounts FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all accounts"
  ON public.accounts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for account_balances
CREATE POLICY "Users can view own account balances"
  ON public.account_balances FOR SELECT
  USING (
    account_id IN (
      SELECT id FROM public.accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all balances"
  ON public.account_balances FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for beneficiaries
CREATE POLICY "Users can view own beneficiaries"
  ON public.beneficiaries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own beneficiaries"
  ON public.beneficiaries FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all beneficiaries"
  ON public.beneficiaries FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for standing_orders
CREATE POLICY "Users can view own standing orders"
  ON public.standing_orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all standing orders"
  ON public.standing_orders FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for direct_debits
CREATE POLICY "Users can view own direct debits"
  ON public.direct_debits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all direct debits"
  ON public.direct_debits FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Indexes for performance
CREATE INDEX idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX idx_accounts_account_id ON public.accounts(account_id);
CREATE INDEX idx_account_balances_account_id ON public.account_balances(account_id);
CREATE INDEX idx_beneficiaries_account_id ON public.beneficiaries(account_id);
CREATE INDEX idx_beneficiaries_user_id ON public.beneficiaries(user_id);
CREATE INDEX idx_standing_orders_account_id ON public.standing_orders(account_id);
CREATE INDEX idx_standing_orders_user_id ON public.standing_orders(user_id);
CREATE INDEX idx_direct_debits_account_id ON public.direct_debits(account_id);
CREATE INDEX idx_direct_debits_user_id ON public.direct_debits(user_id);
CREATE INDEX idx_transactions_account_id ON public.transactions(account_id);

-- Triggers for updated_at
CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_account_balances_updated_at
  BEFORE UPDATE ON public.account_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_beneficiaries_updated_at
  BEFORE UPDATE ON public.beneficiaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_standing_orders_updated_at
  BEFORE UPDATE ON public.standing_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_direct_debits_updated_at
  BEFORE UPDATE ON public.direct_debits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check AISP consent permissions
CREATE OR REPLACE FUNCTION public.check_aisp_permission(
  _consent_id TEXT,
  _user_id UUID,
  _permission TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consent RECORD;
BEGIN
  -- Get consent
  SELECT * INTO v_consent
  FROM public.aisp_consents
  WHERE consent_id = _consent_id
    AND user_id = _user_id
    AND status = 'Authorised'
    AND expiration_date > NOW();
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check if permission is granted
  RETURN (v_consent.permissions::jsonb) ? _permission;
END;
$$;