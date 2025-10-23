-- Create supported currencies table
CREATE TABLE supported_currencies (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  provider TEXT NOT NULL,
  supported_countries TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial currencies
INSERT INTO supported_currencies (code, name, symbol, provider, supported_countries) VALUES
('XAF', 'Central African CFA Franc', 'FCFA', 'flutterwave', ARRAY['CM', 'CF', 'TD', 'CG', 'GQ', 'GA']),
('NGN', 'Nigerian Naira', '₦', 'flutterwave', ARRAY['NG']),
('GHS', 'Ghanaian Cedi', '₵', 'flutterwave', ARRAY['GH']),
('KES', 'Kenyan Shilling', 'KSh', 'flutterwave', ARRAY['KE']),
('UGX', 'Ugandan Shilling', 'USh', 'flutterwave', ARRAY['UG']),
('TZS', 'Tanzanian Shilling', 'TSh', 'flutterwave', ARRAY['TZ']),
('ZAR', 'South African Rand', 'R', 'flutterwave', ARRAY['ZA']),
('RWF', 'Rwandan Franc', 'RF', 'flutterwave', ARRAY['RW']),
('USD', 'US Dollar', '$', 'stripe', ARRAY['US']),
('EUR', 'Euro', '€', 'stripe', ARRAY['EU']),
('GBP', 'British Pound', '£', 'stripe', ARRAY['GB']);

-- Card payment transactions table
CREATE TABLE card_payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  transaction_ref TEXT NOT NULL UNIQUE,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  transaction_type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  card_brand TEXT,
  card_last4 TEXT,
  card_country TEXT,
  customer_email TEXT,
  customer_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  description TEXT,
  metadata JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Saved cards table (tokenized)
CREATE TABLE saved_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  stripe_payment_method_id TEXT NOT NULL UNIQUE,
  card_brand TEXT NOT NULL,
  card_last4 TEXT NOT NULL,
  card_exp_month INTEGER NOT NULL,
  card_exp_year INTEGER NOT NULL,
  card_country TEXT,
  billing_name TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bank transfer transactions table
CREATE TABLE bank_transfer_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  transaction_ref TEXT NOT NULL UNIQUE,
  flutterwave_ref TEXT,
  transaction_type TEXT NOT NULL,
  bank_code TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  narration TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE card_payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transfer_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for card_payment_transactions
CREATE POLICY "Users can view own card transactions"
  ON card_payment_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own card transactions"
  ON card_payment_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all card transactions"
  ON card_payment_transactions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for saved_cards
CREATE POLICY "Users can view own saved cards"
  ON saved_cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own saved cards"
  ON saved_cards FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all saved cards"
  ON saved_cards FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for bank_transfer_transactions
CREATE POLICY "Users can view own bank transfers"
  ON bank_transfer_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own bank transfers"
  ON bank_transfer_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all bank transfers"
  ON bank_transfer_transactions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add update trigger for updated_at columns
CREATE TRIGGER update_card_payment_transactions_updated_at
  BEFORE UPDATE ON card_payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_saved_cards_updated_at
  BEFORE UPDATE ON saved_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bank_transfer_transactions_updated_at
  BEFORE UPDATE ON bank_transfer_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();