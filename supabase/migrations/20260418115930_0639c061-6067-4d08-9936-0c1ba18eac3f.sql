-- 1) Backfill default email preferences for any user with a credit profile but no prefs row
INSERT INTO public.crediq_email_preferences (user_id, score_change_alerts, weekly_digest, monthly_report, goal_achievement_alerts, tips_recommendations, product_recommendations, marketing_emails)
SELECT cp.user_id, true, true, true, true, true, false, false
FROM public.credit_profiles cp
LEFT JOIN public.crediq_email_preferences cep ON cep.user_id = cp.user_id
WHERE cep.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- 2) Auto-create preferences when a new credit profile appears
CREATE OR REPLACE FUNCTION public.ensure_crediq_email_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.crediq_email_preferences (
    user_id, score_change_alerts, weekly_digest, monthly_report,
    goal_achievement_alerts, tips_recommendations, product_recommendations, marketing_emails
  )
  VALUES (NEW.user_id, true, true, true, true, true, false, false)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_crediq_email_preferences ON public.credit_profiles;
CREATE TRIGGER trg_ensure_crediq_email_preferences
AFTER INSERT ON public.credit_profiles
FOR EACH ROW EXECUTE FUNCTION public.ensure_crediq_email_preferences();

-- 3) Dispatch audit log
CREATE TABLE IF NOT EXISTS public.crediq_report_dispatch_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_type TEXT NOT NULL CHECK (dispatch_type IN ('monthly_report','weekly_digest')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  total_users INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  error_details JSONB,
  triggered_by TEXT NOT NULL DEFAULT 'cron'
);

CREATE INDEX IF NOT EXISTS idx_crediq_report_dispatch_log_type_time
  ON public.crediq_report_dispatch_log (dispatch_type, started_at DESC);

ALTER TABLE public.crediq_report_dispatch_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read dispatch log" ON public.crediq_report_dispatch_log;
CREATE POLICY "Admins read dispatch log"
ON public.crediq_report_dispatch_log
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));