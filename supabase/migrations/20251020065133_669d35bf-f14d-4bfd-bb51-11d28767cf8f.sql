-- =========================================
-- COMPREHENSIVE SECURITY FIXES MIGRATION
-- =========================================

-- 1. Fix RLS Policies for Token Tables
DROP POLICY IF EXISTS "block-all-access" ON public.access_tokens;
DROP POLICY IF EXISTS "No direct user access to access tokens" ON public.access_tokens;

CREATE POLICY "Service role can manage access tokens"
ON public.access_tokens
FOR ALL
USING (auth.jwt()->>'role' = 'service_role')
WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Users can view their own active tokens"
ON public.access_tokens
FOR SELECT
USING (auth.uid() = user_id AND is_revoked = false);

CREATE POLICY "Admins can view all tokens for audit"
ON public.access_tokens
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Refresh Tokens
DROP POLICY IF EXISTS "block-all-refresh" ON public.refresh_tokens;
DROP POLICY IF EXISTS "No direct user access to refresh tokens" ON public.refresh_tokens;

CREATE POLICY "Service role can manage refresh tokens"
ON public.refresh_tokens
FOR ALL
USING (auth.jwt()->>'role' = 'service_role')
WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Users can view their own active refresh tokens"
ON public.refresh_tokens
FOR SELECT
USING (auth.uid() = user_id AND is_revoked = false);

-- Authorization Codes
DROP POLICY IF EXISTS "block-all-codes" ON public.authorization_codes;
DROP POLICY IF EXISTS "No direct user access to authorization codes" ON public.authorization_codes;

CREATE POLICY "Service role can manage authorization codes"
ON public.authorization_codes
FOR ALL
USING (auth.jwt()->>'role' = 'service_role')
WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- PAR Requests
DROP POLICY IF EXISTS "block-all-par" ON public.par_requests;
DROP POLICY IF EXISTS "No direct user access to PAR requests" ON public.par_requests;

CREATE POLICY "Service role can manage par requests"
ON public.par_requests
FOR ALL
USING (auth.jwt()->>'role' = 'service_role')
WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- 2. Fix Sandbox Accounts - Require Authentication
DROP POLICY IF EXISTS "Anyone can view sandbox accounts" ON public.sandbox_accounts;

CREATE POLICY "Authenticated users can view sandbox accounts"
ON public.sandbox_accounts
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 3. Create Session State Table for CSRF Protection
CREATE TABLE IF NOT EXISTS public.oauth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  state text NOT NULL UNIQUE,
  client_id text NOT NULL,
  redirect_uri text NOT NULL,
  scope text,
  code_challenge text,
  code_challenge_method text DEFAULT 'S256',
  nonce text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  used boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_oauth_sessions_state ON public.oauth_sessions(state);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_expires ON public.oauth_sessions(expires_at);

ALTER TABLE public.oauth_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
ON public.oauth_sessions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage sessions"
ON public.oauth_sessions
FOR ALL
USING (auth.jwt()->>'role' = 'service_role')
WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- 4. Add enhanced functions
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.oauth_sessions WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$;

CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup 
ON public.rate_limits(client_id, endpoint, window_start);

CREATE OR REPLACE FUNCTION public.check_aisp_permission_with_account(
  _consent_id text,
  _user_id uuid,
  _permission text,
  _account_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consent RECORD;
BEGIN
  SELECT * INTO v_consent
  FROM public.aisp_consents
  WHERE consent_id = _consent_id
    AND user_id = _user_id
    AND status = 'Authorised'
    AND expiration_date > NOW();
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  IF NOT ((v_consent.permissions::jsonb) ? _permission) THEN
    RETURN FALSE;
  END IF;
  
  IF _account_id IS NOT NULL THEN
    IF v_consent.account_ids IS NOT NULL AND 
       jsonb_array_length(v_consent.account_ids::jsonb) > 0 THEN
      IF NOT ((v_consent.account_ids::jsonb) ? _account_id) THEN
        RETURN FALSE;
      END IF;
    END IF;
  END IF;
  
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_pisp_consent(
  _consent_id text,
  _user_id uuid,
  _amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consent RECORD;
BEGIN
  SELECT * INTO v_consent
  FROM public.pisp_consents
  WHERE consent_id = _consent_id
    AND user_id = _user_id
    AND status = 'Authorised'
    AND expires_at > NOW();
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Consent not found or expired');
  END IF;
  
  RETURN jsonb_build_object('valid', true, 'consent', to_jsonb(v_consent));
END;
$$;