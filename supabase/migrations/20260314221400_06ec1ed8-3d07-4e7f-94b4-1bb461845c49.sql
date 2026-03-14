
-- Phase 1: Identity Modernization — 6 new tables + extensions

-- 1. Developer Organizations
CREATE TABLE public.developer_orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  user_id UUID NOT NULL,
  website TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'sandbox_active' CHECK (status IN ('sandbox_active', 'prod_requested', 'prod_approved', 'suspended')),
  country TEXT DEFAULT 'CM',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.developer_orgs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own developer orgs" ON public.developer_orgs
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own developer orgs" ON public.developer_orgs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own developer orgs" ON public.developer_orgs
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all developer orgs" ON public.developer_orgs
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 2. MFA Factors
CREATE TABLE public.mfa_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sms_otp', 'totp', 'email_otp')),
  secret_encrypted TEXT,
  phone_snapshot TEXT,
  email_snapshot TEXT,
  friendly_name TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mfa_factors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own MFA factors" ON public.mfa_factors
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can manage own MFA factors" ON public.mfa_factors
  FOR ALL TO authenticated USING (user_id = auth.uid());

-- 3. MFA Challenges
CREATE TABLE public.mfa_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  factor_id UUID NOT NULL REFERENCES public.mfa_factors(id) ON DELETE CASCADE,
  challenge_code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mfa_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for MFA challenges" ON public.mfa_challenges
  FOR ALL TO service_role USING (true);

-- 4. Onboarding Applications (unified tracker)
CREATE TABLE public.onboarding_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('personal', 'merchant', 'institution', 'developer_org')),
  entity_id UUID NOT NULL,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected')),
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewer_user_id UUID,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own onboarding applications" ON public.onboarding_applications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own onboarding applications" ON public.onboarding_applications
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own draft applications" ON public.onboarding_applications
  FOR UPDATE TO authenticated USING (user_id = auth.uid() AND status = 'draft');

CREATE POLICY "Admins can manage all onboarding applications" ON public.onboarding_applications
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5. User Sessions (device tracking)
CREATE TABLE public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  device_fingerprint TEXT,
  ip_address TEXT,
  user_agent TEXT,
  app_context TEXT DEFAULT 'web',
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions" ON public.user_sessions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Service role manages sessions" ON public.user_sessions
  FOR ALL TO service_role USING (true);

-- 6. Identity Memberships (entity-scoped RBAC)
CREATE TABLE public.identity_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('institution', 'merchant', 'developer_org', 'platform')),
  entity_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, entity_type, entity_id)
);

ALTER TABLE public.identity_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memberships" ON public.identity_memberships
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all memberships" ON public.identity_memberships
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Extension: Add onboarding_status to gateway_merchants (backwards compatible)
ALTER TABLE public.gateway_merchants ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'active';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_developer_orgs_user_id ON public.developer_orgs(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_factors_user_id ON public.mfa_factors(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_challenges_user_id ON public.mfa_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_challenges_factor_id ON public.mfa_challenges(factor_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_applications_user_id ON public.onboarding_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_applications_entity ON public.onboarding_applications(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_applications_status ON public.onboarding_applications(status);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_identity_memberships_user_id ON public.identity_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_identity_memberships_entity ON public.identity_memberships(entity_type, entity_id);
