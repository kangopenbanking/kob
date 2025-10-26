-- Security Fix 1: Restrict institution data visibility
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Users can view own institution" ON public.institutions;
DROP POLICY IF EXISTS "Admins can view all institutions" ON public.institutions;

-- Create strict RLS policy - users only see their own institution
CREATE POLICY "Users view own institution only"
ON public.institutions
FOR SELECT
USING (
  user_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin')
);

-- Security Fix 2: Tighten audit log policy
-- Remove permissive INSERT policy
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.audit_logs;

-- Create SECURITY DEFINER function for audit logging
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _action_type TEXT,
  _entity_type TEXT,
  _entity_id UUID,
  _details JSONB DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_id UUID;
  v_ip_address TEXT;
BEGIN
  -- Safely get IP address from request headers
  BEGIN
    v_ip_address := current_setting('request.headers', true)::json->>'x-forwarded-for';
  EXCEPTION WHEN OTHERS THEN
    v_ip_address := NULL;
  END;

  INSERT INTO public.audit_logs (
    action_type,
    entity_type,
    entity_id,
    performed_by,
    details,
    ip_address
  ) VALUES (
    _action_type,
    _entity_type,
    _entity_id,
    auth.uid(),
    _details,
    v_ip_address::inet
  ) RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.log_audit_event TO authenticated;

-- Only service role can directly insert (for system operations)
CREATE POLICY "Only service role can insert audit logs"
ON public.audit_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- Security Fix 3: Add function to encrypt sandbox credentials
CREATE OR REPLACE FUNCTION public.encrypt_sandbox_credentials(
  _institution_id UUID,
  _client_id TEXT,
  _client_secret TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hashed_secret TEXT;
BEGIN
  -- Hash the client secret using bcrypt via pg_crypto
  -- Note: In production, consider using Supabase Vault for encryption
  v_hashed_secret := crypt(_client_secret, gen_salt('bf', 10));
  
  UPDATE public.institutions
  SET sandbox_credentials = jsonb_build_object(
    'client_id', _client_id,
    'secret_hash', v_hashed_secret,
    'encrypted_at', NOW()
  ),
  updated_at = NOW()
  WHERE id = _institution_id
    AND (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.encrypt_sandbox_credentials TO authenticated;

-- Security Fix 4: Add function to verify sandbox credentials
CREATE OR REPLACE FUNCTION public.verify_sandbox_credentials(
  _institution_id UUID,
  _client_id TEXT,
  _client_secret TEXT
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stored_creds JSONB;
  v_stored_hash TEXT;
BEGIN
  SELECT sandbox_credentials INTO v_stored_creds
  FROM public.institutions
  WHERE id = _institution_id;
  
  IF v_stored_creds IS NULL THEN
    RETURN false;
  END IF;
  
  IF (v_stored_creds->>'client_id') != _client_id THEN
    RETURN false;
  END IF;
  
  v_stored_hash := v_stored_creds->>'secret_hash';
  
  -- Verify using bcrypt
  RETURN v_stored_hash = crypt(_client_secret, v_stored_hash);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_sandbox_credentials TO authenticated;