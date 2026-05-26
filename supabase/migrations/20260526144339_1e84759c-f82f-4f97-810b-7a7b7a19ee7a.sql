
CREATE TABLE IF NOT EXISTS public.qr_telemetry_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  event_type TEXT NOT NULL CHECK (event_type IN ('scan','payment','parse')),
  status TEXT NOT NULL CHECK (status IN ('success','error','retry')),
  error_code TEXT,
  error_message TEXT,
  surface TEXT,
  qr_type TEXT,
  merchant_id TEXT,
  amount NUMERIC,
  currency TEXT,
  latency_ms INTEGER,
  attempt INTEGER NOT NULL DEFAULT 1,
  client_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qr_telemetry_created_at ON public.qr_telemetry_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qr_telemetry_error_code ON public.qr_telemetry_events (error_code) WHERE error_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_qr_telemetry_type_status ON public.qr_telemetry_events (event_type, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qr_telemetry_user ON public.qr_telemetry_events (user_id, created_at DESC);

GRANT SELECT, INSERT ON public.qr_telemetry_events TO authenticated;
GRANT ALL ON public.qr_telemetry_events TO service_role;

ALTER TABLE public.qr_telemetry_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own qr telemetry"
  ON public.qr_telemetry_events FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users view own qr telemetry"
  ON public.qr_telemetry_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.qr_telemetry_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type TEXT NOT NULL,
  window_minutes INTEGER NOT NULL,
  count INTEGER NOT NULL,
  threshold INTEGER NOT NULL,
  error_code TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qr_telemetry_alerts_created ON public.qr_telemetry_alerts (created_at DESC);

GRANT SELECT ON public.qr_telemetry_alerts TO authenticated;
GRANT ALL ON public.qr_telemetry_alerts TO service_role;

ALTER TABLE public.qr_telemetry_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view qr alerts"
  ON public.qr_telemetry_alerts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
