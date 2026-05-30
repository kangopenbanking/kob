-- OTP request log
CREATE TABLE public.otp_request_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  phone_hash TEXT NOT NULL,
  phone_country_code TEXT,
  region TEXT,
  status TEXT NOT NULL CHECK (status IN ('requested','verified','failed','blocked')),
  error_code TEXT,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_otp_log_ip_created ON public.otp_request_log(ip_address, created_at DESC);
CREATE INDEX idx_otp_log_phone_created ON public.otp_request_log(phone_hash, created_at DESC);
CREATE INDEX idx_otp_log_created ON public.otp_request_log(created_at DESC);

GRANT SELECT, INSERT ON public.otp_request_log TO authenticated;
GRANT ALL ON public.otp_request_log TO service_role;

ALTER TABLE public.otp_request_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read otp request log"
ON public.otp_request_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role inserts otp log"
ON public.otp_request_log FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- IP block list
CREATE TABLE public.otp_ip_block (
  ip_address TEXT NOT NULL PRIMARY KEY,
  reason TEXT NOT NULL,
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.otp_ip_block TO authenticated;
GRANT ALL ON public.otp_ip_block TO service_role;

ALTER TABLE public.otp_ip_block ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage otp ip block"
ON public.otp_ip_block FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Helper: is_ip_blocked
CREATE OR REPLACE FUNCTION public.is_otp_ip_blocked(_ip TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.otp_ip_block
    WHERE ip_address = _ip
      AND (blocked_until IS NULL OR blocked_until > now())
  );
$$;

-- Helper: record_otp_request — inserts log row and auto-flags suspicious IPs
CREATE OR REPLACE FUNCTION public.record_otp_request(
  _ip TEXT,
  _phone_hash TEXT,
  _country TEXT,
  _region TEXT,
  _status TEXT,
  _error_code TEXT,
  _user_agent TEXT,
  _metadata JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
  _distinct_phones INT;
  _rapid_retries INT;
BEGIN
  INSERT INTO public.otp_request_log (
    ip_address, phone_hash, phone_country_code, region, status, error_code, user_agent, metadata
  )
  VALUES (_ip, _phone_hash, _country, _region, _status, _error_code, _user_agent, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO _id;

  -- Multiple distinct phones from same IP in last hour
  SELECT COUNT(DISTINCT phone_hash) INTO _distinct_phones
  FROM public.otp_request_log
  WHERE ip_address = _ip AND created_at > now() - interval '1 hour';

  -- Rapid retries in last 5 minutes
  SELECT COUNT(*) INTO _rapid_retries
  FROM public.otp_request_log
  WHERE ip_address = _ip AND created_at > now() - interval '5 minutes';

  IF _distinct_phones >= 5 OR _rapid_retries >= 10 THEN
    INSERT INTO public.otp_ip_block (ip_address, reason, blocked_until, metadata)
    VALUES (
      _ip,
      CASE WHEN _distinct_phones >= 5 THEN 'multi_phone_abuse' ELSE 'rapid_retry_abuse' END,
      now() + interval '24 hours',
      jsonb_build_object('distinct_phones_1h', _distinct_phones, 'requests_5m', _rapid_retries)
    )
    ON CONFLICT (ip_address) DO UPDATE
    SET reason = EXCLUDED.reason,
        blocked_until = EXCLUDED.blocked_until,
        metadata = EXCLUDED.metadata;
  END IF;

  RETURN _id;
END;
$$;