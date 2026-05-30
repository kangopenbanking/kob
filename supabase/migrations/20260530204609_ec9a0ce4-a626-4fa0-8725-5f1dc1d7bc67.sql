-- ============================================================
-- B: MFA Backup Codes  +  D: Unified Notification Delivery Telemetry
-- ============================================================

-- ---------- B: MFA backup codes ----------
CREATE TABLE IF NOT EXISTS public.mfa_backup_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  used_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '365 days')
);

CREATE INDEX IF NOT EXISTS idx_mfa_backup_codes_user ON public.mfa_backup_codes(user_id) WHERE used_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mfa_backup_codes_hash ON public.mfa_backup_codes(user_id, code_hash);

GRANT SELECT ON public.mfa_backup_codes TO authenticated;
GRANT ALL ON public.mfa_backup_codes TO service_role;

ALTER TABLE public.mfa_backup_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own backup codes metadata"
  ON public.mfa_backup_codes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- service-role only for INSERT/UPDATE (generation + redemption via edge function)

-- ---------- D: Unified notification delivery telemetry ----------
DO $$ BEGIN
  CREATE TYPE public.notification_channel AS ENUM ('email', 'push', 'sms');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_event_status AS ENUM (
    'queued','sent','delivered','failed','bounced','complained',
    'opened','clicked','suppressed','rate_limited','expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.notification_delivery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel public.notification_channel NOT NULL,
  status public.notification_event_status NOT NULL,
  provider TEXT,                            -- 'lovable_email','firebase','onesignal'
  template_name TEXT,
  message_id TEXT,
  recipient_hash TEXT,                      -- SHA-256 of email/phone/external_user_id
  region TEXT,                              -- ISO country code if known
  user_id UUID,
  latency_ms INTEGER,
  error_code TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ndev_channel_created ON public.notification_delivery_events(channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ndev_status_created  ON public.notification_delivery_events(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ndev_message_id      ON public.notification_delivery_events(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ndev_user            ON public.notification_delivery_events(user_id, created_at DESC) WHERE user_id IS NOT NULL;

GRANT SELECT ON public.notification_delivery_events TO authenticated;
GRANT ALL ON public.notification_delivery_events TO service_role;

ALTER TABLE public.notification_delivery_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read all delivery events"
  ON public.notification_delivery_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users read own delivery events"
  ON public.notification_delivery_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- service role inserts only

-- ---------- RPCs ----------

-- Log a delivery event (service-definer so edge functions with anon key can call after JWT validation)
CREATE OR REPLACE FUNCTION public.log_notification_event(
  _channel public.notification_channel,
  _status public.notification_event_status,
  _provider TEXT DEFAULT NULL,
  _template_name TEXT DEFAULT NULL,
  _message_id TEXT DEFAULT NULL,
  _recipient_hash TEXT DEFAULT NULL,
  _region TEXT DEFAULT NULL,
  _user_id UUID DEFAULT NULL,
  _latency_ms INTEGER DEFAULT NULL,
  _error_code TEXT DEFAULT NULL,
  _error_message TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
BEGIN
  INSERT INTO public.notification_delivery_events
    (channel,status,provider,template_name,message_id,recipient_hash,region,user_id,latency_ms,error_code,error_message,metadata)
  VALUES
    (_channel,_status,_provider,_template_name,_message_id,_recipient_hash,_region,_user_id,_latency_ms,_error_code,_error_message,COALESCE(_metadata,'{}'::jsonb))
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_notification_event(
  public.notification_channel, public.notification_event_status, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, INTEGER, TEXT, TEXT, JSONB
) TO authenticated, service_role;

-- Aggregated delivery KPIs (admins only)
CREATE OR REPLACE FUNCTION public.notification_delivery_kpis(
  _since TIMESTAMPTZ DEFAULT (now() - interval '24 hours')
) RETURNS TABLE (
  channel public.notification_channel,
  total BIGINT,
  sent BIGINT,
  delivered BIGINT,
  failed BIGINT,
  bounced BIGINT,
  suppressed BIGINT,
  rate_limited BIGINT,
  success_rate NUMERIC,
  p50_latency_ms NUMERIC,
  p95_latency_ms NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    e.channel,
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE e.status = 'sent')::BIGINT,
    COUNT(*) FILTER (WHERE e.status = 'delivered')::BIGINT,
    COUNT(*) FILTER (WHERE e.status = 'failed')::BIGINT,
    COUNT(*) FILTER (WHERE e.status = 'bounced')::BIGINT,
    COUNT(*) FILTER (WHERE e.status = 'suppressed')::BIGINT,
    COUNT(*) FILTER (WHERE e.status = 'rate_limited')::BIGINT,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE e.status IN ('sent','delivered','opened','clicked'))
      / NULLIF(COUNT(*),0), 2
    ) AS success_rate,
    percentile_cont(0.5)  WITHIN GROUP (ORDER BY e.latency_ms) FILTER (WHERE e.latency_ms IS NOT NULL),
    percentile_cont(0.95) WITHIN GROUP (ORDER BY e.latency_ms) FILTER (WHERE e.latency_ms IS NOT NULL)
  FROM public.notification_delivery_events e
  WHERE e.created_at >= _since
  GROUP BY e.channel;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notification_delivery_kpis(TIMESTAMPTZ) TO authenticated, service_role;