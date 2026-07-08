
INSERT INTO public.kyc_feature_flags (flag_key, is_enabled, rollout_percentage, country_codes, user_whitelist)
VALUES
  ('didit.global',    true,  100, ARRAY[]::text[], ARRAY[]::uuid[]),
  ('didit.rollout',   true,  100, ARRAY[]::text[], ARRAY[]::uuid[]),
  ('didit.countries', true,  100, ARRAY['CM','GA','CG','TD','CF','GQ','NG','SN','CI','ML','BF','TG','BJ','GN']::text[], ARRAY[]::uuid[])
ON CONFLICT (flag_key) DO NOTHING;

INSERT INTO public.kyc_circuit_breaker_state (provider, state, failure_count, window_started_at, opened_at)
VALUES ('didit', 'closed', 0, now(), NULL)
ON CONFLICT (provider) DO NOTHING;

ALTER TABLE public.kyc_verifications
  ADD COLUMN IF NOT EXISTS didit_session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_kyc_verifications_didit_session_id
  ON public.kyc_verifications (didit_session_id)
  WHERE didit_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.didit_webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  webhook_type TEXT NOT NULL,
  session_id TEXT,
  vendor_data TEXT,
  status TEXT,
  workflow_id TEXT,
  payload JSONB NOT NULL,
  signature_valid BOOLEAN NOT NULL DEFAULT true,
  processed BOOLEAN NOT NULL DEFAULT false,
  processing_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

GRANT SELECT ON public.didit_webhook_events TO authenticated;
GRANT ALL ON public.didit_webhook_events TO service_role;

ALTER TABLE public.didit_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view didit webhook events"
  ON public.didit_webhook_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_didit_webhook_events_session_id
  ON public.didit_webhook_events (session_id);
CREATE INDEX IF NOT EXISTS idx_didit_webhook_events_vendor_data
  ON public.didit_webhook_events (vendor_data);
CREATE INDEX IF NOT EXISTS idx_didit_webhook_events_received_at
  ON public.didit_webhook_events (received_at DESC);
