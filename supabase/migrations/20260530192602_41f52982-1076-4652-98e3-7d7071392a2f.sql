
CREATE TABLE IF NOT EXISTS public.firebase_otp_test_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tester_id uuid,
  scenario text NOT NULL,
  phone_number text NOT NULL,
  step text NOT NULL,
  status text NOT NULL,
  provider text,
  error_code text,
  error_message text,
  elapsed_ms integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.firebase_otp_test_log TO authenticated;
GRANT ALL ON public.firebase_otp_test_log TO service_role;

ALTER TABLE public.firebase_otp_test_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read firebase otp test log"
ON public.firebase_otp_test_log
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert firebase otp test log"
ON public.firebase_otp_test_log
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND tester_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_firebase_otp_test_log_created
ON public.firebase_otp_test_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_firebase_otp_test_log_scenario
ON public.firebase_otp_test_log (scenario, created_at DESC);
