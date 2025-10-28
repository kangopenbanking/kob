-- Phase 2: Business Current Accounts Schema Enhancements

-- Add business-specific columns to accounts table
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS business_details JSONB,
ADD COLUMN IF NOT EXISTS transaction_limits JSONB,
ADD COLUMN IF NOT EXISTS authorized_signatories JSONB[];

-- Create business_kyc table for enhanced business verification
CREATE TABLE IF NOT EXISTS public.business_kyc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  account_id UUID REFERENCES public.accounts(id),
  
  -- Business Information
  business_name TEXT NOT NULL,
  registration_number TEXT NOT NULL UNIQUE,
  business_type TEXT NOT NULL, -- 'sole_proprietorship', 'partnership', 'limited_company', 'cooperative', 'ngo'
  industry TEXT NOT NULL,
  vat_number TEXT,
  tax_id TEXT,
  
  -- Registration Details
  registration_date DATE,
  registration_country TEXT DEFAULT 'CM',
  registration_authority TEXT,
  
  -- Business Address
  business_address JSONB NOT NULL,
  -- Structure: {"street": "", "city": "", "state": "", "postal_code": "", "country": ""}
  
  -- Business Documents
  registration_certificate_url TEXT,
  tax_certificate_url TEXT,
  articles_of_association_url TEXT,
  proof_of_address_url TEXT,
  bank_statement_url TEXT,
  
  -- Directors/Owners Information
  beneficial_owners JSONB[], -- Array of owners with details
  directors JSONB[], -- Array of directors
  
  -- Business Operations
  annual_turnover NUMERIC,
  number_of_employees INTEGER,
  business_description TEXT,
  
  -- Verification Status
  verification_status TEXT NOT NULL DEFAULT 'pending', -- pending, in_review, verified, rejected
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  
  -- Compliance
  sanctions_screened BOOLEAN DEFAULT FALSE,
  sanctions_screen_date TIMESTAMPTZ,
  risk_rating TEXT, -- low, medium, high
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on business_kyc
ALTER TABLE public.business_kyc ENABLE ROW LEVEL SECURITY;

-- RLS Policies for business_kyc
CREATE POLICY "Users can view own business KYC"
  ON public.business_kyc FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own business KYC"
  ON public.business_kyc FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own business KYC"
  ON public.business_kyc FOR UPDATE
  USING (auth.uid() = user_id AND verification_status IN ('pending', 'rejected'));

CREATE POLICY "Admins can view all business KYC"
  ON public.business_kyc FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update business KYC verification"
  ON public.business_kyc FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_business_kyc_user_id ON public.business_kyc(user_id);
CREATE INDEX IF NOT EXISTS idx_business_kyc_account_id ON public.business_kyc(account_id);
CREATE INDEX IF NOT EXISTS idx_business_kyc_status ON public.business_kyc(verification_status);
CREATE INDEX IF NOT EXISTS idx_business_kyc_registration_number ON public.business_kyc(registration_number);

-- Create business_account_signatories table for multi-user access
CREATE TABLE IF NOT EXISTS public.business_account_signatories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Signatory Details
  role TEXT NOT NULL, -- 'owner', 'director', 'authorized_signatory', 'view_only'
  permissions JSONB NOT NULL DEFAULT '{"view": true, "transfer": false, "approve": false}'::jsonb,
  
  -- Authorization Limits
  daily_transaction_limit NUMERIC,
  single_transaction_limit NUMERIC,
  requires_approval BOOLEAN DEFAULT FALSE,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active', -- active, suspended, revoked
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  invited_by UUID REFERENCES auth.users(id),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(account_id, user_id)
);

-- Enable RLS on business_account_signatories
ALTER TABLE public.business_account_signatories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for business_account_signatories
CREATE POLICY "Users can view signatories of their business accounts"
  ON public.business_account_signatories FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = business_account_signatories.account_id
      AND accounts.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.business_account_signatories s2
      WHERE s2.account_id = business_account_signatories.account_id
      AND s2.user_id = auth.uid()
      AND s2.status = 'active'
    )
  );

CREATE POLICY "Account owners can manage signatories"
  ON public.business_account_signatories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = business_account_signatories.account_id
      AND accounts.user_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_business_signatories_account_id ON public.business_account_signatories(account_id);
CREATE INDEX IF NOT EXISTS idx_business_signatories_user_id ON public.business_account_signatories(user_id);
CREATE INDEX IF NOT EXISTS idx_business_signatories_status ON public.business_account_signatories(status);

-- Create trigger for updating business_kyc updated_at
CREATE OR REPLACE FUNCTION public.update_business_kyc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_business_kyc_updated_at
  BEFORE UPDATE ON public.business_kyc
  FOR EACH ROW
  EXECUTE FUNCTION public.update_business_kyc_updated_at();

-- Create trigger for updating business_account_signatories updated_at
CREATE OR REPLACE FUNCTION public.update_business_signatories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_business_signatories_updated_at
  BEFORE UPDATE ON public.business_account_signatories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_business_signatories_updated_at();

-- Add comments for documentation
COMMENT ON TABLE public.business_kyc IS 'Enhanced KYC verification for business accounts';
COMMENT ON TABLE public.business_account_signatories IS 'Multi-user access control for business accounts';
COMMENT ON COLUMN public.accounts.business_details IS 'Business-specific information (name, registration, VAT number, etc.)';
COMMENT ON COLUMN public.accounts.transaction_limits IS 'Daily, monthly, and per-transaction limits';
COMMENT ON COLUMN public.accounts.authorized_signatories IS 'Array of user IDs authorized to operate the account';