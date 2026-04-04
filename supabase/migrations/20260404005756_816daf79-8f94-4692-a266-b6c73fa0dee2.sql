-- Add public-facing fields to merchant_trust_scores
ALTER TABLE public.merchant_trust_scores
  ADD COLUMN IF NOT EXISTS trust_tier text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS score_history jsonb[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS factors_summary jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS badge_issued_at timestamptz;

-- Add document expiry and verification source to checks
ALTER TABLE public.business_verification_checks
  ADD COLUMN IF NOT EXISTS document_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_source text;

-- Create public business profiles table
CREATE TABLE IF NOT EXISTS public.public_business_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  business_type text,
  industry text,
  country text DEFAULT 'CM',
  city text,
  trust_tier text NOT NULL DEFAULT 'unverified',
  verification_badge text DEFAULT 'none',
  verified_since timestamptz,
  public_description text,
  website_url text,
  registration_country text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(merchant_id)
);

ALTER TABLE public.public_business_profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can view active public profiles
CREATE POLICY "Public business profiles are publicly readable"
  ON public.public_business_profiles FOR SELECT
  USING (is_active = true);

-- Only admins can insert
CREATE POLICY "Admins can create public profiles"
  ON public.public_business_profiles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can update
CREATE POLICY "Admins can update public profiles"
  ON public.public_business_profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete
CREATE POLICY "Admins can delete public profiles"
  ON public.public_business_profiles FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Add public read policy for trust scores when is_public = true
CREATE POLICY "Public trust scores are publicly readable"
  ON public.merchant_trust_scores FOR SELECT
  USING (is_public = true);

-- Trigger for updated_at
CREATE TRIGGER update_public_business_profiles_updated_at
  BEFORE UPDATE ON public.public_business_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_business_kyc_updated_at();