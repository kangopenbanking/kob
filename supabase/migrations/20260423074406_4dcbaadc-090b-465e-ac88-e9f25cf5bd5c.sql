-- Admin alerts table for email queue & DLQ monitoring
CREATE TABLE IF NOT EXISTS public.admin_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,           -- 'email_dlq_growth' | 'email_queue_backlog' | 'email_send_failure_spike'
  severity TEXT NOT NULL DEFAULT 'warning', -- 'info' | 'warning' | 'critical'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_alerts_unack
  ON public.admin_alerts (created_at DESC)
  WHERE acknowledged_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_admin_alerts_type
  ON public.admin_alerts (alert_type, created_at DESC);

ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all alerts"
  ON public.admin_alerts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can acknowledge alerts"
  ON public.admin_alerts FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- DLQ redelivery tracking table — records each automated retry attempt
CREATE TABLE IF NOT EXISTS public.email_dlq_redeliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_message_id TEXT NOT NULL,
  new_message_id TEXT NOT NULL,
  template_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  redelivery_attempt INT NOT NULL DEFAULT 1,
  triggered_by TEXT NOT NULL DEFAULT 'cron', -- 'cron' | 'admin'
  triggered_by_user UUID,
  result_status TEXT,                        -- 'queued' | 'failed'
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dlq_redeliveries_original
  ON public.email_dlq_redeliveries (original_message_id);

CREATE INDEX IF NOT EXISTS idx_dlq_redeliveries_recipient
  ON public.email_dlq_redeliveries (recipient_email, created_at DESC);

ALTER TABLE public.email_dlq_redeliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view DLQ redeliveries"
  ON public.email_dlq_redeliveries FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));