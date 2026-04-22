ALTER TABLE public.email_send_log
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_event text,
  ADD COLUMN IF NOT EXISTS provider_event_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_email_send_log_next_retry
  ON public.email_send_log (next_retry_at)
  WHERE next_retry_at IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='email_send_log'
      AND policyname='Admins can read email send log'
  ) THEN
    CREATE POLICY "Admins can read email send log"
      ON public.email_send_log
      FOR SELECT
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END$$;