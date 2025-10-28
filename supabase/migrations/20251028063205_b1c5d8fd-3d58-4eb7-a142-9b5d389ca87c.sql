-- Create enums for virtual cards
CREATE TYPE card_status AS ENUM ('active', 'inactive', 'blocked', 'cancelled');
CREATE TYPE spending_limit_interval AS ENUM ('per_authorization', 'daily', 'weekly', 'monthly', 'yearly', 'all_time');
CREATE TYPE card_funding_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
CREATE TYPE card_transaction_type AS ENUM ('authorization', 'capture', 'refund', 'reversal');

-- Virtual card programs (different card types/tiers)
CREATE TABLE public.virtual_card_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES public.institutions(id),
  program_name TEXT NOT NULL,
  program_description TEXT,
  monthly_fee NUMERIC(10,2) DEFAULT 0,
  transaction_fee_percentage NUMERIC(5,2) DEFAULT 0,
  transaction_fee_fixed NUMERIC(10,2) DEFAULT 0,
  max_balance NUMERIC(10,2),
  daily_spend_limit NUMERIC(10,2),
  monthly_spend_limit NUMERIC(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stripe cardholders (one per user)
CREATE TABLE public.stripe_cardholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  stripe_cardholder_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_number TEXT,
  billing_address JSONB,
  status TEXT DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Virtual cards
CREATE TABLE public.virtual_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  cardholder_id UUID REFERENCES public.stripe_cardholders(id) ON DELETE CASCADE NOT NULL,
  program_id UUID REFERENCES public.virtual_card_programs(id),
  stripe_card_id TEXT UNIQUE NOT NULL,
  card_name TEXT NOT NULL,
  last4 TEXT NOT NULL,
  exp_month INTEGER NOT NULL,
  exp_year INTEGER NOT NULL,
  brand TEXT NOT NULL DEFAULT 'Visa',
  status card_status DEFAULT 'active',
  balance_usd NUMERIC(10,2) DEFAULT 0,
  spending_controls JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Card funding transactions (top-ups)
CREATE TABLE public.card_funding_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  virtual_card_id UUID REFERENCES public.virtual_cards(id) ON DELETE CASCADE NOT NULL,
  source_account_id UUID REFERENCES public.accounts(id),
  transaction_ref TEXT UNIQUE NOT NULL,
  amount_source_currency NUMERIC(10,2) NOT NULL,
  source_currency TEXT NOT NULL,
  amount_usd NUMERIC(10,2) NOT NULL,
  exchange_rate NUMERIC(10,6) NOT NULL,
  exchange_rate_source TEXT NOT NULL,
  conversion_fee NUMERIC(10,2) DEFAULT 0,
  stripe_funding_id TEXT,
  status card_funding_status DEFAULT 'pending',
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Card transactions (purchases/authorizations)
CREATE TABLE public.card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  virtual_card_id UUID REFERENCES public.virtual_cards(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  stripe_authorization_id TEXT,
  stripe_transaction_id TEXT,
  amount_usd NUMERIC(10,2) NOT NULL,
  merchant_name TEXT,
  merchant_category TEXT,
  merchant_country TEXT,
  transaction_type card_transaction_type,
  status TEXT,
  decline_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exchange rates cache
CREATE TABLE public.exchange_rates_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency TEXT NOT NULL,
  target_currency TEXT NOT NULL,
  rate NUMERIC(10,6) NOT NULL,
  rate_source TEXT NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(base_currency, target_currency, rate_source)
);

-- Enable RLS
ALTER TABLE public.virtual_card_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_cardholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.virtual_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_funding_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for virtual_card_programs
CREATE POLICY "Anyone can view active programs"
  ON public.virtual_card_programs FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage programs"
  ON public.virtual_card_programs FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for stripe_cardholders
CREATE POLICY "Users can view own cardholder"
  ON public.stripe_cardholders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cardholder"
  ON public.stripe_cardholders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all cardholders"
  ON public.stripe_cardholders FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for virtual_cards
CREATE POLICY "Users can view own virtual cards"
  ON public.virtual_cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own virtual cards"
  ON public.virtual_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own virtual cards"
  ON public.virtual_cards FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all virtual cards"
  ON public.virtual_cards FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for card_funding_transactions
CREATE POLICY "Users can view own funding transactions"
  ON public.card_funding_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own funding transactions"
  ON public.card_funding_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all funding transactions"
  ON public.card_funding_transactions FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for card_transactions
CREATE POLICY "Users can view own card transactions"
  ON public.card_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all card transactions"
  ON public.card_transactions FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for exchange_rates_cache
CREATE POLICY "Anyone can view exchange rates"
  ON public.exchange_rates_cache FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage exchange rates"
  ON public.exchange_rates_cache FOR ALL
  USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Create indexes
CREATE INDEX idx_virtual_cards_user_id ON public.virtual_cards(user_id);
CREATE INDEX idx_virtual_cards_status ON public.virtual_cards(status);
CREATE INDEX idx_card_funding_transactions_user_id ON public.card_funding_transactions(user_id);
CREATE INDEX idx_card_funding_transactions_card_id ON public.card_funding_transactions(virtual_card_id);
CREATE INDEX idx_card_transactions_card_id ON public.card_transactions(virtual_card_id);
CREATE INDEX idx_card_transactions_user_id ON public.card_transactions(user_id);
CREATE INDEX idx_exchange_rates_currencies ON public.exchange_rates_cache(base_currency, target_currency);

-- Create updated_at triggers
CREATE TRIGGER update_virtual_card_programs_updated_at
  BEFORE UPDATE ON public.virtual_card_programs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stripe_cardholders_updated_at
  BEFORE UPDATE ON public.stripe_cardholders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_virtual_cards_updated_at
  BEFORE UPDATE ON public.virtual_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default virtual card program
INSERT INTO public.virtual_card_programs (
  program_name,
  program_description,
  monthly_fee,
  transaction_fee_percentage,
  transaction_fee_fixed,
  max_balance,
  daily_spend_limit,
  monthly_spend_limit,
  is_active
) VALUES (
  'Standard Virtual Card',
  'Standard USD virtual card for online purchases worldwide',
  0,
  0,
  0,
  5000,
  500,
  2000,
  true
);

-- Add comments
COMMENT ON TABLE public.virtual_card_programs IS 'Virtual card programs with different tiers and limits';
COMMENT ON TABLE public.stripe_cardholders IS 'Stripe Issuing cardholders linked to users';
COMMENT ON TABLE public.virtual_cards IS 'Virtual cards issued via Stripe Issuing';
COMMENT ON TABLE public.card_funding_transactions IS 'Top-up transactions with currency conversion';
COMMENT ON TABLE public.card_transactions IS 'Card purchase transactions and authorizations';
COMMENT ON TABLE public.exchange_rates_cache IS 'Cached exchange rates to reduce API calls';