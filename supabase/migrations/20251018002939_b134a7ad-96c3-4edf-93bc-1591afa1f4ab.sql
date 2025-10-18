-- Phase 1: Security & Authentication Infrastructure
-- Tables for FAPI 1.0 Advanced, DCR, and mTLS

-- 1. Client Certificates for mTLS
CREATE TABLE public.client_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  certificate_pem TEXT NOT NULL,
  fingerprint TEXT NOT NULL UNIQUE,
  subject_dn TEXT NOT NULL,
  issuer_dn TEXT NOT NULL,
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  is_revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  revocation_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TPP (Third-Party Provider) Registrations
CREATE TABLE public.tpp_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL UNIQUE,
  client_secret TEXT NOT NULL,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  software_id TEXT NOT NULL,
  software_statement TEXT NOT NULL, -- SSA JWT
  software_roles TEXT[] NOT NULL, -- AISP, PISP, CBPII
  redirect_uris TEXT[] NOT NULL,
  grant_types TEXT[] NOT NULL DEFAULT ARRAY['authorization_code', 'refresh_token'],
  response_types TEXT[] NOT NULL DEFAULT ARRAY['code'],
  token_endpoint_auth_method TEXT NOT NULL DEFAULT 'tls_client_auth',
  jwks_uri TEXT,
  jwks JSONB,
  scope TEXT NOT NULL DEFAULT 'accounts payments',
  is_active BOOLEAN DEFAULT TRUE,
  environment TEXT NOT NULL DEFAULT 'sandbox', -- sandbox or production
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Pushed Authorization Requests (PAR)
CREATE TABLE public.par_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_uri TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  request_object TEXT NOT NULL, -- Signed JWT
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Authorization Codes (for OAuth2 flow)
CREATE TABLE public.authorization_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  scope TEXT NOT NULL,
  consent_id UUID, -- References consent tables (to be created in Phase 2)
  code_challenge TEXT,
  code_challenge_method TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Access Tokens
CREATE TABLE public.access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  consent_id UUID,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Refresh Tokens
CREATE TABLE public.refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  access_token_id UUID REFERENCES public.access_tokens(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Platform Signing Keys (for JWKS)
CREATE TABLE public.signing_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kid TEXT NOT NULL UNIQUE,
  kty TEXT NOT NULL DEFAULT 'RSA',
  alg TEXT NOT NULL DEFAULT 'RS256',
  use TEXT NOT NULL DEFAULT 'sig',
  n TEXT NOT NULL, -- Public modulus
  e TEXT NOT NULL, -- Public exponent
  private_key TEXT NOT NULL, -- Encrypted private key
  is_active BOOLEAN DEFAULT TRUE,
  rotated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.client_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tpp_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.par_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authorization_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signing_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client_certificates
CREATE POLICY "Admins can view all certificates"
  ON public.client_certificates FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Institutions can view own certificates"
  ON public.client_certificates FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.tpp_registrations 
      WHERE institution_id IN (
        SELECT id FROM public.institutions WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policies for tpp_registrations
CREATE POLICY "Admins can view all TPP registrations"
  ON public.tpp_registrations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage TPP registrations"
  ON public.tpp_registrations FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Institutions can view own TPP registration"
  ON public.tpp_registrations FOR SELECT
  USING (
    institution_id IN (
      SELECT id FROM public.institutions WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for signing_keys (admin only)
CREATE POLICY "Admins can view signing keys"
  ON public.signing_keys FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage signing keys"
  ON public.signing_keys FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- No RLS policies for par_requests, authorization_codes, access_tokens, refresh_tokens
-- These are managed entirely by edge functions

-- Indexes for performance
CREATE INDEX idx_client_certificates_client_id ON public.client_certificates(client_id);
CREATE INDEX idx_client_certificates_fingerprint ON public.client_certificates(fingerprint);
CREATE INDEX idx_tpp_registrations_client_id ON public.tpp_registrations(client_id);
CREATE INDEX idx_tpp_registrations_institution_id ON public.tpp_registrations(institution_id);
CREATE INDEX idx_par_requests_request_uri ON public.par_requests(request_uri);
CREATE INDEX idx_par_requests_expires_at ON public.par_requests(expires_at);
CREATE INDEX idx_authorization_codes_code ON public.authorization_codes(code);
CREATE INDEX idx_authorization_codes_expires_at ON public.authorization_codes(expires_at);
CREATE INDEX idx_access_tokens_token_hash ON public.access_tokens(token_hash);
CREATE INDEX idx_access_tokens_expires_at ON public.access_tokens(expires_at);
CREATE INDEX idx_refresh_tokens_token_hash ON public.refresh_tokens(token_hash);

-- Trigger for updated_at
CREATE TRIGGER update_client_certificates_updated_at
  BEFORE UPDATE ON public.client_certificates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tpp_registrations_updated_at
  BEFORE UPDATE ON public.tpp_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to clean up expired PAR requests (cron job can call this)
CREATE OR REPLACE FUNCTION public.cleanup_expired_par_requests()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.par_requests
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$;

-- Function to clean up expired authorization codes
CREATE OR REPLACE FUNCTION public.cleanup_expired_auth_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.authorization_codes
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$;