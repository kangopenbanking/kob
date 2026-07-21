
-- Tracking table to throttle KYC reminder emails (one row per user)
CREATE TABLE IF NOT EXISTS public.kyc_reminder_log (
  user_id UUID PRIMARY KEY,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.kyc_reminder_log TO authenticated;
GRANT ALL ON public.kyc_reminder_log TO service_role;

ALTER TABLE public.kyc_reminder_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view kyc reminder log" ON public.kyc_reminder_log;
CREATE POLICY "Admins view kyc reminder log"
  ON public.kyc_reminder_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Daily cron at 09:00 UTC
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_extension WHERE extname = 'pg_cron'
  ) THEN
    CREATE EXTENSION pg_cron WITH SCHEMA extensions;
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_extension WHERE extname = 'pg_net'
  ) THEN
    CREATE EXTENSION pg_net WITH SCHEMA extensions;
  END IF;
END
$$;

DO $$
DECLARE
  jid BIGINT;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'kyc-incomplete-reminder';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;

SELECT cron.schedule(
  'kyc-incomplete-reminder',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url:='https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/kyc-incomplete-reminder',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indkemt6ZWFoZHR4bHluZXRuZHF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTQ1OTksImV4cCI6MjA4ODQ3MDU5OX0.i-5Sx5xz2ntXQ9mTEfOJ4PQKuaeWRycvbkAQQfx2zYg","x-trigger-source":"cron"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);
