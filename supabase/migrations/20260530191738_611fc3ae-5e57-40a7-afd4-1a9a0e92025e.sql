
CREATE TABLE public.push_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  notification_id uuid,
  triggered_by uuid,
  title text NOT NULL,
  message text NOT NULL,
  type text,
  payload jsonb,
  onesignal_id text,
  recipients integer,
  status text NOT NULL DEFAULT 'pending',
  http_status integer,
  error_code text,
  error_body jsonb,
  attempts integer NOT NULL DEFAULT 0,
  elapsed_ms integer,
  test_mode boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.push_delivery_log TO authenticated;
GRANT ALL ON public.push_delivery_log TO service_role;

ALTER TABLE public.push_delivery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all push delivery log"
  ON public.push_delivery_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own push delivery log"
  ON public.push_delivery_log FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_push_delivery_log_user_created ON public.push_delivery_log(user_id, created_at DESC);
CREATE INDEX idx_push_delivery_log_status ON public.push_delivery_log(status, created_at DESC);
