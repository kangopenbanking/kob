
ALTER TABLE public.email_send_log
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS triggered_by text;

CREATE INDEX IF NOT EXISTS idx_email_send_log_user_id ON public.email_send_log(user_id);
CREATE INDEX IF NOT EXISTS idx_email_send_log_template_status_created
  ON public.email_send_log(template_name, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_status_created
  ON public.email_send_log(status, created_at DESC);
