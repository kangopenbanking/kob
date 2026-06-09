
-- 1) External SSO-ready identifiers
CREATE TABLE IF NOT EXISTS public.user_external_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  institution_id uuid NULL,
  provider text NOT NULL,
  external_id text NOT NULL,
  email text NULL,
  verified_at timestamptz NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_id)
);
CREATE INDEX IF NOT EXISTS idx_user_external_identifiers_user ON public.user_external_identifiers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_external_identifiers_inst ON public.user_external_identifiers(institution_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_external_identifiers TO authenticated;
GRANT ALL ON public.user_external_identifiers TO service_role;

ALTER TABLE public.user_external_identifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own external ids"
  ON public.user_external_identifiers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users insert own external ids"
  ON public.user_external_identifiers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users update own external ids"
  ON public.user_external_identifiers FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete external ids"
  ON public.user_external_identifiers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) Audit log for email auth events
CREATE TABLE IF NOT EXISTS public.email_auth_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  email_hash text GENERATED ALWAYS AS (lower(email)) STORED,
  user_id uuid NULL,
  institution_id uuid NULL,
  account_type text NULL,
  action text NOT NULL,
  outcome text NOT NULL,
  reason text NULL,
  ip_address inet NULL,
  user_agent text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_auth_audit_email ON public.email_auth_audit(email_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_auth_audit_ip ON public.email_auth_audit(ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_auth_audit_user ON public.email_auth_audit(user_id, created_at DESC);

GRANT SELECT ON public.email_auth_audit TO authenticated;
GRANT ALL ON public.email_auth_audit TO service_role;

ALTER TABLE public.email_auth_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read all email auth audit"
  ON public.email_auth_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users read own email auth audit"
  ON public.email_auth_audit FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 3) Rate-limit window tracker for email auth
CREATE TABLE IF NOT EXISTS public.email_auth_rate_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,                 -- 'email' or 'ip'
  key text NOT NULL,                   -- lowercased email or ip text
  action text NOT NULL,                -- 'signup','magic','resend','admin_magic'
  attempts int NOT NULL DEFAULT 0,
  failures int NOT NULL DEFAULT 0,
  blocked_until timestamptz NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  last_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, key, action)
);
CREATE INDEX IF NOT EXISTS idx_email_auth_rate_state_block ON public.email_auth_rate_state(blocked_until);

GRANT ALL ON public.email_auth_rate_state TO service_role;
ALTER TABLE public.email_auth_rate_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read rate state"
  ON public.email_auth_rate_state FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4) Rate-limit check function (server-side use only)
CREATE OR REPLACE FUNCTION public.check_email_auth_limit(
  _scope text, _key text, _action text,
  _max_attempts int, _window_seconds int, _max_failures int, _block_minutes int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.email_auth_rate_state;
  now_ts timestamptz := now();
BEGIN
  SELECT * INTO row FROM public.email_auth_rate_state
   WHERE scope = _scope AND key = _key AND action = _action FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.email_auth_rate_state(scope, key, action, attempts, last_at)
    VALUES (_scope, _key, _action, 1, now_ts)
    RETURNING * INTO row;
    RETURN jsonb_build_object('allowed', true, 'remaining', _max_attempts - 1);
  END IF;

  IF row.blocked_until IS NOT NULL AND row.blocked_until > now_ts THEN
    RETURN jsonb_build_object(
      'allowed', false, 'reason', 'blocked',
      'retry_after_seconds', EXTRACT(EPOCH FROM (row.blocked_until - now_ts))::int
    );
  END IF;

  -- Roll window
  IF row.window_start < now_ts - (_window_seconds || ' seconds')::interval THEN
    UPDATE public.email_auth_rate_state
       SET attempts = 1, failures = 0, window_start = now_ts, last_at = now_ts,
           blocked_until = NULL
     WHERE id = row.id;
    RETURN jsonb_build_object('allowed', true, 'remaining', _max_attempts - 1);
  END IF;

  IF row.attempts >= _max_attempts THEN
    UPDATE public.email_auth_rate_state
       SET blocked_until = now_ts + (_block_minutes || ' minutes')::interval,
           last_at = now_ts
     WHERE id = row.id;
    RETURN jsonb_build_object(
      'allowed', false, 'reason', 'rate_limited',
      'retry_after_seconds', _block_minutes * 60
    );
  END IF;

  UPDATE public.email_auth_rate_state
     SET attempts = attempts + 1, last_at = now_ts
   WHERE id = row.id;

  RETURN jsonb_build_object('allowed', true, 'remaining', _max_attempts - row.attempts - 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_email_auth_failure(
  _scope text, _key text, _action text, _max_failures int, _block_minutes int
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.email_auth_rate_state;
BEGIN
  SELECT * INTO row FROM public.email_auth_rate_state
   WHERE scope = _scope AND key = _key AND action = _action FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.email_auth_rate_state(scope, key, action, failures, last_at)
    VALUES (_scope, _key, _action, 1, now());
    RETURN;
  END IF;
  UPDATE public.email_auth_rate_state
     SET failures = failures + 1, last_at = now(),
         blocked_until = CASE WHEN failures + 1 >= _max_failures
                              THEN now() + (_block_minutes || ' minutes')::interval
                              ELSE blocked_until END
   WHERE id = row.id;
END;
$$;

REVOKE ALL ON FUNCTION public.check_email_auth_limit(text,text,text,int,int,int,int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_email_auth_failure(text,text,text,int,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_email_auth_limit(text,text,text,int,int,int,int) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_email_auth_failure(text,text,text,int,int) TO service_role;

-- Trigger to bump updated_at on user_external_identifiers
CREATE OR REPLACE FUNCTION public.tg_uei_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS user_external_identifiers_touch ON public.user_external_identifiers;
CREATE TRIGGER user_external_identifiers_touch
BEFORE UPDATE ON public.user_external_identifiers
FOR EACH ROW EXECUTE FUNCTION public.tg_uei_touch();
