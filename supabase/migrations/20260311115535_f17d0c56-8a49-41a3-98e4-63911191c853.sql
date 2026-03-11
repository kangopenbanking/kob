-- Pre-approved loan offers (managed by banks)
CREATE TABLE preapproved_loan_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  description TEXT,
  min_credit_score INTEGER NOT NULL,
  max_credit_score INTEGER NOT NULL DEFAULT 850,
  min_amount NUMERIC NOT NULL DEFAULT 50000,
  max_amount NUMERIC NOT NULL DEFAULT 5000000,
  interest_rate_annual NUMERIC NOT NULL,
  max_tenure_months INTEGER NOT NULL DEFAULT 36,
  currency TEXT NOT NULL DEFAULT 'XAF',
  requires_existing_account BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE preapproved_loan_offers ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view active offers (marketplace)
CREATE POLICY "Authenticated users can view active offers"
  ON preapproved_loan_offers FOR SELECT TO authenticated
  USING (is_active = true AND effective_from <= CURRENT_DATE AND (effective_to IS NULL OR effective_to >= CURRENT_DATE));

-- Institution owners/staff can manage their offers
CREATE POLICY "Institution owners can manage offers"
  ON preapproved_loan_offers FOR ALL TO authenticated
  USING (
    public.is_institution_owner(auth.uid(), institution_id) OR
    public.get_staff_institution_id(auth.uid()) = institution_id
  )
  WITH CHECK (
    public.is_institution_owner(auth.uid(), institution_id) OR
    public.get_staff_institution_id(auth.uid()) = institution_id
  );

-- Pre-approved loan applications
CREATE TABLE preapproved_loan_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES preapproved_loan_offers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  requested_amount NUMERIC NOT NULL,
  requested_tenure_months INTEGER,
  status TEXT NOT NULL DEFAULT 'pending_review',
  credit_score_at_application INTEGER,
  hard_inquiry_id UUID REFERENCES credit_inquiries(id),
  has_existing_account BOOLEAN DEFAULT false,
  decline_reason TEXT,
  score_impact INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE preapproved_loan_applications ENABLE ROW LEVEL SECURITY;

-- Users can view their own applications
CREATE POLICY "Users can view own applications"
  ON preapproved_loan_applications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own applications
CREATE POLICY "Users can create applications"
  ON preapproved_loan_applications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Institution staff can view their institution's applications
CREATE POLICY "Institution staff can view applications"
  ON preapproved_loan_applications FOR SELECT TO authenticated
  USING (
    public.is_institution_owner(auth.uid(), institution_id) OR
    public.get_staff_institution_id(auth.uid()) = institution_id
  );

-- Institution staff can update application status
CREATE POLICY "Institution staff can update applications"
  ON preapproved_loan_applications FOR UPDATE TO authenticated
  USING (
    public.is_institution_owner(auth.uid(), institution_id) OR
    public.get_staff_institution_id(auth.uid()) = institution_id
  );

-- Add score_impact column to credit_inquiries if not exists
ALTER TABLE credit_inquiries ADD COLUMN IF NOT EXISTS score_impact INTEGER DEFAULT 0;
ALTER TABLE credit_inquiries ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';