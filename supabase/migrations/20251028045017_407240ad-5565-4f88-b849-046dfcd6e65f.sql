-- Phase 3: Savings Accounts Implementation

-- Create savings_type enum
CREATE TYPE savings_type AS ENUM (
  'regular_savings',
  'fixed_deposit',
  'goal_savings',
  'high_yield',
  'kids_savings',
  'emergency_fund'
);

-- Create savings_products table
CREATE TABLE IF NOT EXISTS public.savings_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES public.institutions(id),
  
  -- Product details
  product_name TEXT NOT NULL,
  product_code TEXT NOT NULL UNIQUE,
  savings_type savings_type NOT NULL,
  description TEXT,
  
  -- Interest rates
  base_interest_rate NUMERIC NOT NULL,
  interest_payment_frequency TEXT NOT NULL, -- 'monthly', 'quarterly', 'annually', 'maturity'
  tiered_rates JSONB, -- [{"min_balance": 0, "max_balance": 10000, "rate": 2.5}, ...]
  
  -- Terms
  min_balance NUMERIC DEFAULT 0,
  min_opening_balance NUMERIC NOT NULL,
  max_balance NUMERIC,
  lock_in_period_months INTEGER, -- For fixed deposits
  
  -- Restrictions
  max_withdrawals_per_month INTEGER,
  withdrawal_penalty_rate NUMERIC,
  early_closure_penalty NUMERIC,
  
  -- Fees
  monthly_maintenance_fee NUMERIC DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create savings_accounts table
CREATE TABLE IF NOT EXISTS public.savings_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id), -- Link to main accounts table
  user_id UUID NOT NULL REFERENCES auth.users(id),
  product_id UUID NOT NULL REFERENCES public.savings_products(id),
  
  -- Account details
  savings_type savings_type NOT NULL,
  account_name TEXT, -- User-defined name (e.g., "Holiday Fund")
  
  -- Goal settings (for goal-based savings)
  target_amount NUMERIC,
  target_date DATE,
  auto_save_enabled BOOLEAN DEFAULT FALSE,
  auto_save_amount NUMERIC,
  auto_save_frequency TEXT, -- 'daily', 'weekly', 'monthly'
  auto_save_day INTEGER,
  
  -- Balances
  current_balance NUMERIC NOT NULL DEFAULT 0,
  available_balance NUMERIC NOT NULL DEFAULT 0, -- May differ if locked
  interest_accrued NUMERIC NOT NULL DEFAULT 0,
  total_interest_earned NUMERIC NOT NULL DEFAULT 0,
  
  -- Interest tracking
  last_interest_date DATE,
  next_interest_date DATE,
  current_interest_rate NUMERIC NOT NULL,
  
  -- Lock details (for fixed deposits)
  maturity_date DATE,
  is_locked BOOLEAN DEFAULT FALSE,
  
  -- Restrictions
  withdrawals_this_month INTEGER DEFAULT 0,
  last_withdrawal_date DATE,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active', -- active, dormant, closed
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create savings_transactions table
CREATE TABLE IF NOT EXISTS public.savings_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  savings_account_id UUID NOT NULL REFERENCES public.savings_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  transaction_id UUID REFERENCES public.transactions(id), -- Link to main transactions
  
  -- Transaction details
  transaction_type TEXT NOT NULL, -- 'deposit', 'withdrawal', 'interest', 'fee', 'penalty'
  amount NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  
  -- Interest calculation (if applicable)
  interest_period_start DATE,
  interest_period_end DATE,
  interest_rate NUMERIC,
  
  -- Source/Destination
  source_account_id UUID REFERENCES public.accounts(id),
  destination_account_id UUID REFERENCES public.accounts(id),
  
  -- Description
  description TEXT,
  reference TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create savings_interest_calculations table
CREATE TABLE IF NOT EXISTS public.savings_interest_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  savings_account_id UUID NOT NULL REFERENCES public.savings_accounts(id) ON DELETE CASCADE,
  
  -- Period
  calculation_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Calculation
  average_balance NUMERIC NOT NULL,
  interest_rate NUMERIC NOT NULL,
  days_in_period INTEGER NOT NULL,
  interest_amount NUMERIC NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, credited, failed
  credited_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.savings_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_interest_calculations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for savings_products
CREATE POLICY "Anyone can view active savings products"
  ON public.savings_products FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Admins can manage savings products"
  ON public.savings_products FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for savings_accounts
CREATE POLICY "Users can view own savings accounts"
  ON public.savings_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own savings accounts"
  ON public.savings_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own savings accounts"
  ON public.savings_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all savings accounts"
  ON public.savings_accounts FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for savings_transactions
CREATE POLICY "Users can view own savings transactions"
  ON public.savings_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all savings transactions"
  ON public.savings_transactions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for savings_interest_calculations
CREATE POLICY "Users can view own interest calculations"
  ON public.savings_interest_calculations FOR SELECT
  USING (
    savings_account_id IN (
      SELECT id FROM public.savings_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage interest calculations"
  ON public.savings_interest_calculations FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_savings_products_type ON public.savings_products(savings_type);
CREATE INDEX IF NOT EXISTS idx_savings_products_active ON public.savings_products(is_active);
CREATE INDEX IF NOT EXISTS idx_savings_accounts_user_id ON public.savings_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_accounts_product_id ON public.savings_accounts(product_id);
CREATE INDEX IF NOT EXISTS idx_savings_accounts_status ON public.savings_accounts(status);
CREATE INDEX IF NOT EXISTS idx_savings_accounts_maturity ON public.savings_accounts(maturity_date) WHERE maturity_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_savings_transactions_account_id ON public.savings_transactions(savings_account_id);
CREATE INDEX IF NOT EXISTS idx_savings_transactions_type ON public.savings_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_savings_interest_status ON public.savings_interest_calculations(status);
CREATE INDEX IF NOT EXISTS idx_savings_interest_date ON public.savings_interest_calculations(calculation_date);

-- Create triggers for updated_at
CREATE TRIGGER update_savings_products_updated_at
  BEFORE UPDATE ON public.savings_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_savings_accounts_updated_at
  BEFORE UPDATE ON public.savings_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default savings products
INSERT INTO public.savings_products (product_name, product_code, savings_type, description, base_interest_rate, interest_payment_frequency, min_opening_balance, max_withdrawals_per_month) VALUES
('Regular Savings Account', 'RSA-001', 'regular_savings', 'Flexible savings account with competitive interest rates', 3.5, 'monthly', 10000, 4),
('High Yield Savings', 'HYS-001', 'high_yield', 'Premium savings account with higher interest rates for larger balances', 5.0, 'monthly', 100000, 2),
('Fixed Deposit 6 Months', 'FD6-001', 'fixed_deposit', '6-month fixed deposit with guaranteed returns', 6.0, 'maturity', 50000, 0),
('Fixed Deposit 12 Months', 'FD12-001', 'fixed_deposit', '12-month fixed deposit with higher interest rates', 7.5, 'maturity', 50000, 0),
('Goal Savings', 'GOAL-001', 'goal_savings', 'Save towards a specific goal with automated deposits', 4.0, 'monthly', 5000, 2),
('Kids Savings', 'KIDS-001', 'kids_savings', 'Savings account for children with parental controls', 4.5, 'quarterly', 5000, 1),
('Emergency Fund', 'EMR-001', 'emergency_fund', 'Quick-access savings for emergencies', 3.0, 'monthly', 10000, 6);

-- Update fixed deposit products with lock-in periods
UPDATE public.savings_products 
SET lock_in_period_months = 6, early_closure_penalty = 1.0 
WHERE product_code = 'FD6-001';

UPDATE public.savings_products 
SET lock_in_period_months = 12, early_closure_penalty = 1.5 
WHERE product_code = 'FD12-001';

-- Add tiered rates for high yield savings
UPDATE public.savings_products 
SET tiered_rates = '[
  {"min_balance": 0, "max_balance": 500000, "rate": 5.0},
  {"min_balance": 500001, "max_balance": 1000000, "rate": 5.5},
  {"min_balance": 1000001, "max_balance": null, "rate": 6.0}
]'::jsonb
WHERE product_code = 'HYS-001';

-- Add comments for documentation
COMMENT ON TABLE public.savings_products IS 'Savings account product definitions and terms';
COMMENT ON TABLE public.savings_accounts IS 'Individual savings accounts for users';
COMMENT ON TABLE public.savings_transactions IS 'Transaction history for savings accounts';
COMMENT ON TABLE public.savings_interest_calculations IS 'Interest calculation records for savings accounts';