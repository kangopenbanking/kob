-- ============================================================================
-- Versioned API key rotation
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.api_client_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_client_id uuid NOT NULL REFERENCES public.api_clients(id) ON DELETE CASCADE,
  key_version integer NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  label text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending','active','grace','revoked')),
  activated_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  grace_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (api_client_id, key_version)
);

CREATE INDEX IF NOT EXISTS idx_api_client_keys_client ON public.api_client_keys(api_client_id);
CREATE INDEX IF NOT EXISTS idx_api_client_keys_hash_active ON public.api_client_keys(key_hash) WHERE status IN ('active','grace');

ALTER TABLE public.api_client_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage api_client_keys"
  ON public.api_client_keys FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Developers view their own client keys"
  ON public.api_client_keys FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.api_clients c
    WHERE c.id = api_client_keys.api_client_id
      AND c.developer_user_id = auth.uid()
  ));

-- Resolver used by the gateway via PostgREST RPC.
CREATE OR REPLACE FUNCTION public.resolve_api_key(_hash text)
RETURNS TABLE(client_id text, key_version integer, status text, expires_at timestamptz, grace_until timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.client_id, k.key_version, k.status, k.expires_at, k.grace_until
  FROM public.api_client_keys k
  JOIN public.api_clients c ON c.id = k.api_client_id
  WHERE k.key_hash = _hash
    AND c.is_active = true
    AND k.status IN ('active','grace')
    AND (k.expires_at IS NULL OR k.expires_at > now())
    AND (k.grace_until IS NULL OR k.grace_until > now())
  LIMIT 1;
$$;

-- ============================================================================
-- Gateway audit logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.gateway_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text,
  client_id text,
  key_version integer,
  method text NOT NULL,
  path text NOT NULL,
  status integer,
  latency_ms integer,
  ip text,
  user_agent text,
  country text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gateway_audit_created ON public.gateway_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gateway_audit_client ON public.gateway_audit_logs(client_id, created_at DESC);

ALTER TABLE public.gateway_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read gateway audit logs"
  ON public.gateway_audit_logs FOR SELECT
  USING (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Service role inserts gateway audit logs"
  ON public.gateway_audit_logs FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- Per-key rate limit windows
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.gateway_rate_limit_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  window_started_at timestamptz NOT NULL,
  window_seconds integer NOT NULL DEFAULT 60,
  request_count integer NOT NULL DEFAULT 0,
  limit_per_window integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, window_started_at, window_seconds)
);

CREATE INDEX IF NOT EXISTS idx_gw_rl_client_window
  ON public.gateway_rate_limit_windows(client_id, window_started_at DESC);

ALTER TABLE public.gateway_rate_limit_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read rate limit windows"
  ON public.gateway_rate_limit_windows FOR SELECT
  USING (has_role(auth.uid(),'admin'::app_role));