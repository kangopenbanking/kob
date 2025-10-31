-- Task 3.1: Enhanced Consent Event Logging with IP Address Hashing

-- Step 1: Add a function to hash IP addresses using SHA-256
CREATE OR REPLACE FUNCTION public.hash_ip_address(ip_address inet)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
BEGIN
  -- Convert IP to text, hash with SHA-256, return hex string
  RETURN encode(digest(host(ip_address)::text, 'sha256'), 'hex');
END;
$$;

-- Step 2: Add a new column for hashed IP (keep original for backward compatibility initially)
ALTER TABLE public.consent_events 
ADD COLUMN IF NOT EXISTS ip_address_hash text;

-- Step 3: Create index on hashed IP for performance
CREATE INDEX IF NOT EXISTS idx_consent_events_ip_hash 
ON public.consent_events(ip_address_hash);

-- Step 4: Update the log_consent_event function to use hashed IP
CREATE OR REPLACE FUNCTION public.log_consent_event(
  _consent_id text,
  _consent_type text,
  _event_type text,
  _user_id uuid DEFAULT NULL,
  _client_id text DEFAULT NULL,
  _metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event_id UUID;
  v_ip_address inet;
  v_ip_hash text;
BEGIN
  -- Safely extract IP address from request headers
  BEGIN
    v_ip_address := (current_setting('request.headers', true)::json->>'x-forwarded-for')::inet;
    v_ip_hash := public.hash_ip_address(v_ip_address);
  EXCEPTION WHEN OTHERS THEN
    v_ip_address := NULL;
    v_ip_hash := NULL;
  END;

  INSERT INTO public.consent_events (
    consent_id,
    consent_type,
    event_type,
    user_id,
    client_id,
    metadata,
    ip_address_hash
  ) VALUES (
    _consent_id,
    _consent_type,
    _event_type,
    _user_id,
    _client_id,
    _metadata,
    v_ip_hash
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;