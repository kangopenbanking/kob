
CREATE TABLE public.push_test_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by uuid NOT NULL,
  target_external_user_id text,
  title text NOT NULL,
  message text NOT NULL,
  url text,
  onesignal_id text,
  recipients integer,
  status text NOT NULL DEFAULT 'sent',
  error jsonb,
  elapsed_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.push_test_log TO authenticated;
GRANT ALL ON public.push_test_log TO service_role;

ALTER TABLE public.push_test_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view push test log"
ON public.push_test_log FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert push test log"
ON public.push_test_log FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') AND triggered_by = auth.uid());

CREATE INDEX idx_push_test_log_created_at ON public.push_test_log(created_at DESC);
