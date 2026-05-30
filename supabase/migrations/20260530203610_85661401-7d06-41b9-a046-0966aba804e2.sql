
-- =========================================================================
-- Push send audit log
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.push_send_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id UUID,
  attempted_targets TEXT[] NOT NULL DEFAULT '{}',
  allowed BOOLEAN NOT NULL,
  reason TEXT NOT NULL,
  title TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.push_send_audit TO authenticated;
GRANT ALL ON public.push_send_audit TO service_role;

ALTER TABLE public.push_send_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view push send audit"
ON public.push_send_audit
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_push_send_audit_created_at
  ON public.push_send_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_send_audit_caller
  ON public.push_send_audit(caller_id, created_at DESC);

-- =========================================================================
-- Per-recipient email rate limit
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.email_rate_limit (
  recipient_hash TEXT NOT NULL,
  template_name TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (recipient_hash, template_name, window_start)
);

GRANT SELECT ON public.email_rate_limit TO authenticated;
GRANT ALL ON public.email_rate_limit TO service_role;

ALTER TABLE public.email_rate_limit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email rate limit"
ON public.email_rate_limit
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_email_rate_limit_window
  ON public.email_rate_limit(window_start DESC);

-- =========================================================================
-- check_and_increment_email_rate
-- Returns true if allowed (and increments), false if cap exceeded.
-- Window is a rolling hour bucket aligned to the top of the hour.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.check_and_increment_email_rate(
  _recipient_hash TEXT,
  _template_name TEXT,
  _limit INTEGER DEFAULT 10,
  _window_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _window TIMESTAMPTZ;
  _current INTEGER;
BEGIN
  _window := date_trunc('hour', now())
           + (floor(extract(minute FROM now()) / _window_minutes) * _window_minutes) * interval '1 minute';

  INSERT INTO public.email_rate_limit(recipient_hash, template_name, window_start, count)
  VALUES (_recipient_hash, _template_name, _window, 1)
  ON CONFLICT (recipient_hash, template_name, window_start)
  DO UPDATE SET count = public.email_rate_limit.count + 1
  RETURNING count INTO _current;

  IF _current > _limit THEN
    -- Roll back the increment so legitimate later requests aren't penalized
    UPDATE public.email_rate_limit
       SET count = count - 1
     WHERE recipient_hash = _recipient_hash
       AND template_name = _template_name
       AND window_start = _window;
    RETURN FALSE;
  END IF;

  -- Best-effort cleanup of old buckets (>24h)
  DELETE FROM public.email_rate_limit
   WHERE window_start < now() - interval '24 hours';

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_increment_email_rate(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_increment_email_rate(TEXT, TEXT, INTEGER, INTEGER) TO service_role;
