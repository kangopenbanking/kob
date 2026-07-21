
-- ============================================================
-- Email provider settings (singleton row)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_provider_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  primary_provider TEXT NOT NULL DEFAULT 'resend' CHECK (primary_provider IN ('resend','lovable_email')),
  fallback_provider TEXT NOT NULL DEFAULT 'lovable_email' CHECK (fallback_provider IN ('resend','lovable_email','none')),
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production')),
  sandbox_from_email TEXT NOT NULL DEFAULT 'onboarding@resend.dev',
  sandbox_from_name TEXT NOT NULL DEFAULT 'Kang Open Banking (Sandbox)',
  production_from_email TEXT NOT NULL DEFAULT 'noreply@info.kangfintechsolutions.com',
  production_from_name TEXT NOT NULL DEFAULT 'Kang Open Banking',
  reply_to_email TEXT,
  resend_api_key_label TEXT NOT NULL DEFAULT 'RESEND_API_KEY',
  resend_enabled BOOLEAN NOT NULL DEFAULT true,
  fallback_enabled BOOLEAN NOT NULL DEFAULT true,
  weekly_digest_enabled BOOLEAN NOT NULL DEFAULT true,
  monthly_statement_enabled BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row_only CHECK (id = 1)
);

GRANT SELECT, INSERT, UPDATE ON public.email_provider_settings TO authenticated;
GRANT ALL ON public.email_provider_settings TO service_role;

ALTER TABLE public.email_provider_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email provider settings"
ON public.email_provider_settings FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update email provider settings"
ON public.email_provider_settings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert email provider settings"
ON public.email_provider_settings FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') AND id = 1);

INSERT INTO public.email_provider_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- User email preferences (account-wide digests/statements)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_email_preferences (
  user_id UUID PRIMARY KEY,
  weekly_activity_digest BOOLEAN NOT NULL DEFAULT true,
  monthly_statement BOOLEAN NOT NULL DEFAULT true,
  product_announcements BOOLEAN NOT NULL DEFAULT false,
  last_weekly_sent_at TIMESTAMPTZ,
  last_monthly_sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.user_email_preferences TO authenticated;
GRANT ALL ON public.user_email_preferences TO service_role;

ALTER TABLE public.user_email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own email prefs"
ON public.user_email_preferences FOR SELECT
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own email prefs"
ON public.user_email_preferences FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own email prefs"
ON public.user_email_preferences FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all email prefs"
ON public.user_email_preferences FOR SELECT
TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- Updated-at trigger reuse
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_email_provider_settings_updated ON public.email_provider_settings;
CREATE TRIGGER trg_email_provider_settings_updated
BEFORE UPDATE ON public.email_provider_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_user_email_prefs_updated ON public.user_email_preferences;
CREATE TRIGGER trg_user_email_prefs_updated
BEFORE UPDATE ON public.user_email_preferences
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- Cron jobs: weekly digest Mon 08:00 UTC, monthly statement 1st 08:00 UTC
-- ============================================================
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
  weekly_job_id BIGINT;
  monthly_job_id BIGINT;
BEGIN
  SELECT jobid INTO weekly_job_id FROM cron.job WHERE jobname = 'send-weekly-activity-digest';
  IF weekly_job_id IS NOT NULL THEN PERFORM cron.unschedule(weekly_job_id); END IF;

  SELECT jobid INTO monthly_job_id FROM cron.job WHERE jobname = 'send-monthly-statement';
  IF monthly_job_id IS NOT NULL THEN PERFORM cron.unschedule(monthly_job_id); END IF;
END $$;

SELECT cron.schedule(
  'send-weekly-activity-digest',
  '0 8 * * 1',
  $$
  SELECT net.http_post(
    url:='https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/send-weekly-activity-digest',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indkemt6ZWFoZHR4bHluZXRuZHF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTQ1OTksImV4cCI6MjA4ODQ3MDU5OX0.i-5Sx5xz2ntXQ9mTEfOJ4PQKuaeWRycvbkAQQfx2zYg","x-trigger-source":"cron"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'send-monthly-statement',
  '0 8 1 * *',
  $$
  SELECT net.http_post(
    url:='https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/send-monthly-statement',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indkemt6ZWFoZHR4bHluZXRuZHF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTQ1OTksImV4cCI6MjA4ODQ3MDU5OX0.i-5Sx5xz2ntXQ9mTEfOJ4PQKuaeWRycvbkAQQfx2zYg","x-trigger-source":"cron"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);
