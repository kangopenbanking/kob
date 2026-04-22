-- Per-department escalation configuration
ALTER TABLE public.support_departments
  ADD COLUMN IF NOT EXISTS sla_warning_pct INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS sla_escalation_pct INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS escalation_department_id UUID REFERENCES public.support_departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supervisor_email TEXT,
  ADD COLUMN IF NOT EXISTS notify_supervisor BOOLEAN NOT NULL DEFAULT true;

-- Validation: thresholds must be sensible
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_departments_sla_thresholds_chk'
  ) THEN
    ALTER TABLE public.support_departments
      ADD CONSTRAINT support_departments_sla_thresholds_chk
      CHECK (
        sla_warning_pct BETWEEN 1 AND 99
        AND sla_escalation_pct BETWEEN 1 AND 500
        AND sla_warning_pct < sla_escalation_pct
        AND sla_target_minutes BETWEEN 1 AND 1440
      );
  END IF;
END $$;

-- Enriched diagnostics for test sends
ALTER TABLE public.managed_email_test_sends
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS http_status INTEGER,
  ADD COLUMN IF NOT EXISTS provider_response JSONB,
  ADD COLUMN IF NOT EXISTS provider_callback_ok BOOLEAN;

-- Allow 'retrying' status
ALTER TABLE public.managed_email_test_sends
  DROP CONSTRAINT IF EXISTS managed_email_test_sends_status_check;
ALTER TABLE public.managed_email_test_sends
  ADD CONSTRAINT managed_email_test_sends_status_check
  CHECK (status IN ('queued','retrying','sent','failed'));