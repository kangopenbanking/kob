-- Phase 4: Loans Implementation

-- Create loan type enum
CREATE TYPE loan_type AS ENUM ('personal', 'business', 'emergency', 'salary_advance', 'asset_finance');

-- Create loan status enum
CREATE TYPE loan_status AS ENUM ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'disbursed', 'active', 'completed', 'defaulted', 'written_off');

-- Create loan repayment frequency enum
CREATE TYPE repayment_frequency AS ENUM ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly');

-- Loan Products table
CREATE TABLE public.loan_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL,
  product_code TEXT UNIQUE NOT NULL,
  loan_type loan_type NOT NULL,
  description TEXT,
  min_amount NUMERIC NOT NULL CHECK (min_amount > 0),
  max_amount NUMERIC NOT NULL CHECK (max_amount >= min_amount),
  min_tenure_months INTEGER NOT NULL CHECK (min_tenure_months > 0),
  max_tenure_months INTEGER NOT NULL CHECK (max_tenure_months >= min_tenure_months),
  interest_rate NUMERIC NOT NULL CHECK (interest_rate >= 0),
  interest_calculation_method TEXT NOT NULL DEFAULT 'reducing_balance',
  processing_fee_percentage NUMERIC DEFAULT 0 CHECK (processing_fee_percentage >= 0),
  processing_fee_fixed NUMERIC DEFAULT 0 CHECK (processing_fee_fixed >= 0),
  late_payment_penalty_percentage NUMERIC DEFAULT 0 CHECK (late_payment_penalty_percentage >= 0),
  requires_collateral BOOLEAN DEFAULT false,
  requires_guarantor BOOLEAN DEFAULT false,
  min_guarantors INTEGER DEFAULT 0,
  eligibility_criteria JSONB DEFAULT '{}',
  required_documents JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  institution_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loan Applications table
CREATE TABLE public.loan_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_number TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL,
  loan_product_id UUID NOT NULL REFERENCES public.loan_products(id),
  requested_amount NUMERIC NOT NULL CHECK (requested_amount > 0),
  tenure_months INTEGER NOT NULL CHECK (tenure_months > 0),
  purpose TEXT NOT NULL,
  repayment_frequency repayment_frequency NOT NULL DEFAULT 'monthly',
  status loan_status NOT NULL DEFAULT 'draft',
  employment_details JSONB,
  guarantors JSONB DEFAULT '[]',
  collateral_details JSONB,
  supporting_documents JSONB DEFAULT '[]',
  credit_score INTEGER,
  risk_assessment JSONB,
  reviewer_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loan Accounts table
CREATE TABLE public.loan_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_account_number TEXT UNIQUE NOT NULL,
  application_id UUID NOT NULL REFERENCES public.loan_applications(id),
  user_id UUID NOT NULL,
  loan_product_id UUID NOT NULL REFERENCES public.loan_products(id),
  principal_amount NUMERIC NOT NULL CHECK (principal_amount > 0),
  interest_rate NUMERIC NOT NULL CHECK (interest_rate >= 0),
  tenure_months INTEGER NOT NULL CHECK (tenure_months > 0),
  repayment_frequency repayment_frequency NOT NULL,
  total_interest NUMERIC NOT NULL DEFAULT 0,
  processing_fee NUMERIC NOT NULL DEFAULT 0,
  total_payable NUMERIC NOT NULL CHECK (total_payable > 0),
  amount_disbursed NUMERIC NOT NULL DEFAULT 0,
  amount_repaid NUMERIC NOT NULL DEFAULT 0,
  outstanding_balance NUMERIC NOT NULL DEFAULT 0,
  next_payment_date DATE,
  next_payment_amount NUMERIC,
  status loan_status NOT NULL DEFAULT 'approved',
  disbursed_at TIMESTAMPTZ,
  first_repayment_date DATE,
  final_repayment_date DATE,
  completed_at TIMESTAMPTZ,
  defaulted_at TIMESTAMPTZ,
  days_overdue INTEGER DEFAULT 0,
  penalty_charges NUMERIC DEFAULT 0,
  account_id UUID REFERENCES public.accounts(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loan Repayment Schedule table
CREATE TABLE public.loan_repayment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_account_id UUID NOT NULL REFERENCES public.loan_accounts(id),
  installment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  principal_due NUMERIC NOT NULL CHECK (principal_due >= 0),
  interest_due NUMERIC NOT NULL CHECK (interest_due >= 0),
  total_due NUMERIC NOT NULL CHECK (total_due >= 0),
  principal_paid NUMERIC NOT NULL DEFAULT 0,
  interest_paid NUMERIC NOT NULL DEFAULT 0,
  penalty_paid NUMERIC NOT NULL DEFAULT 0,
  total_paid NUMERIC NOT NULL DEFAULT 0,
  outstanding_balance NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  days_overdue INTEGER DEFAULT 0,
  penalty_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(loan_account_id, installment_number)
);

-- Loan Payments table
CREATE TABLE public.loan_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_reference TEXT UNIQUE NOT NULL,
  loan_account_id UUID NOT NULL REFERENCES public.loan_accounts(id),
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  principal_amount NUMERIC NOT NULL DEFAULT 0,
  interest_amount NUMERIC NOT NULL DEFAULT 0,
  penalty_amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL,
  payment_channel TEXT,
  transaction_ref TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.loan_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_repayment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for loan_products
CREATE POLICY "Anyone can view active loan products"
  ON public.loan_products FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage all loan products"
  ON public.loan_products FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for loan_applications
CREATE POLICY "Users can view own loan applications"
  ON public.loan_applications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own loan applications"
  ON public.loan_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own draft applications"
  ON public.loan_applications FOR UPDATE
  USING (auth.uid() = user_id AND status = 'draft');

CREATE POLICY "Admins can view all loan applications"
  ON public.loan_applications FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all loan applications"
  ON public.loan_applications FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for loan_accounts
CREATE POLICY "Users can view own loan accounts"
  ON public.loan_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all loan accounts"
  ON public.loan_accounts FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for loan_repayment_schedules
CREATE POLICY "Users can view own loan schedules"
  ON public.loan_repayment_schedules FOR SELECT
  USING (loan_account_id IN (
    SELECT id FROM public.loan_accounts WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage all schedules"
  ON public.loan_repayment_schedules FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for loan_payments
CREATE POLICY "Users can view own loan payments"
  ON public.loan_payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own loan payments"
  ON public.loan_payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all loan payments"
  ON public.loan_payments FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Create indexes
CREATE INDEX idx_loan_applications_user_id ON public.loan_applications(user_id);
CREATE INDEX idx_loan_applications_status ON public.loan_applications(status);
CREATE INDEX idx_loan_accounts_user_id ON public.loan_accounts(user_id);
CREATE INDEX idx_loan_accounts_status ON public.loan_accounts(status);
CREATE INDEX idx_loan_schedules_loan_account ON public.loan_repayment_schedules(loan_account_id);
CREATE INDEX idx_loan_schedules_due_date ON public.loan_repayment_schedules(due_date);
CREATE INDEX idx_loan_payments_loan_account ON public.loan_payments(loan_account_id);
CREATE INDEX idx_loan_payments_user_id ON public.loan_payments(user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_loan_products_updated_at
  BEFORE UPDATE ON public.loan_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loan_applications_updated_at
  BEFORE UPDATE ON public.loan_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loan_accounts_updated_at
  BEFORE UPDATE ON public.loan_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loan_schedules_updated_at
  BEFORE UPDATE ON public.loan_repayment_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loan_payments_updated_at
  BEFORE UPDATE ON public.loan_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default loan products
INSERT INTO public.loan_products (product_name, product_code, loan_type, description, min_amount, max_amount, min_tenure_months, max_tenure_months, interest_rate, requires_collateral, requires_guarantor, min_guarantors, eligibility_criteria, required_documents) VALUES
('Personal Loan', 'PL-001', 'personal', 'Quick personal loan for any purpose', 100000, 5000000, 3, 60, 18.5, false, true, 1, '{"min_age": 18, "min_income": 50000, "employment_status": ["employed", "self_employed"]}', '["id_card", "proof_of_income", "bank_statement"]'),
('Business Loan', 'BL-001', 'business', 'Loan for business expansion and working capital', 500000, 50000000, 6, 120, 16.0, true, true, 2, '{"min_age": 21, "business_age_months": 12, "min_monthly_revenue": 200000}', '["business_registration", "tax_certificate", "bank_statements", "financial_statements"]'),
('Emergency Loan', 'EL-001', 'emergency', 'Quick emergency loan for urgent needs', 50000, 1000000, 1, 12, 22.0, false, false, 0, '{"min_age": 18, "existing_customer": true}', '["id_card"]'),
('Salary Advance', 'SA-001', 'salary_advance', 'Advance on your monthly salary', 10000, 500000, 1, 3, 5.0, false, false, 0, '{"min_age": 18, "employment_status": ["employed"], "salary_domiciled": true}', '["id_card", "employment_letter"]');

COMMENT ON TABLE public.loan_products IS 'Available loan products with terms and conditions';
COMMENT ON TABLE public.loan_applications IS 'Loan applications submitted by users';
COMMENT ON TABLE public.loan_accounts IS 'Active and completed loan accounts';
COMMENT ON TABLE public.loan_repayment_schedules IS 'Amortization schedule for each loan';
COMMENT ON TABLE public.loan_payments IS 'Loan repayment transactions';