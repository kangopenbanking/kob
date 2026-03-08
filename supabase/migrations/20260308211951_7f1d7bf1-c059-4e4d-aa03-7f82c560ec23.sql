
-- =============================================
-- BATCH 5b: Fix remaining INSERT WITH CHECK(true) on {public}/{authenticated}
-- These should be service_role only since they're called from edge functions
-- =============================================

-- api_health_metrics: "Service role can insert health metrics" is on {public}
DROP POLICY IF EXISTS "Service role can insert health metrics" ON public.api_health_metrics;
CREATE POLICY "Service role can insert health metrics"
  ON public.api_health_metrics FOR INSERT TO service_role
  WITH CHECK (true);

-- communication_logs: "System can insert communication logs" on {public}
DROP POLICY IF EXISTS "System can insert communication logs" ON public.communication_logs;
CREATE POLICY "Service role can insert communication logs"
  ON public.communication_logs FOR INSERT TO service_role
  WITH CHECK (true);

-- consent_events: "Service role can insert consent events" on {authenticated}
DROP POLICY IF EXISTS "Service role can insert consent events" ON public.consent_events;
CREATE POLICY "Service role can insert consent events"
  ON public.consent_events FOR INSERT TO service_role
  WITH CHECK (true);

-- credit_api_usage_logs: "System can create usage logs" on {public}
DROP POLICY IF EXISTS "System can create usage logs" ON public.credit_api_usage_logs;
CREATE POLICY "Service role can create usage logs"
  ON public.credit_api_usage_logs FOR INSERT TO service_role
  WITH CHECK (true);

-- app_notifications: tighten INSERT to require user_id match
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.app_notifications;
CREATE POLICY "Service role can insert notifications"
  ON public.app_notifications FOR INSERT TO service_role
  WITH CHECK (true);
-- Allow authenticated users to insert only their own notifications
CREATE POLICY "Users can insert own notifications"
  ON public.app_notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
