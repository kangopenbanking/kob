
-- =============================================
-- BATCH 5c: Fix remaining INSERT on {public} that should be service_role
-- =============================================

-- sca_challenges
DROP POLICY IF EXISTS "System can create SCA challenges" ON public.sca_challenges;
CREATE POLICY "Service role can create SCA challenges"
  ON public.sca_challenges FOR INSERT TO service_role
  WITH CHECK (true);

-- security_audit_logs
DROP POLICY IF EXISTS "System can insert audit logs" ON public.security_audit_logs;
CREATE POLICY "Service role can insert audit logs"
  ON public.security_audit_logs FOR INSERT TO service_role
  WITH CHECK (true);

-- suspicious_activities
DROP POLICY IF EXISTS "System can insert suspicious activities" ON public.suspicious_activities;
CREATE POLICY "Service role can insert suspicious activities"
  ON public.suspicious_activities FOR INSERT TO service_role
  WITH CHECK (true);

-- system_health_checks
DROP POLICY IF EXISTS "System can insert health checks" ON public.system_health_checks;
CREATE POLICY "Service role can insert health checks"
  ON public.system_health_checks FOR INSERT TO service_role
  WITH CHECK (true);

-- api_demo_logs: check current state - the batch4 migration was supposed to add validation
-- but the old "Anyone can log" policy still exists with CHECK(true). Fix it.
DROP POLICY IF EXISTS "Anyone can log api demo usage" ON public.api_demo_logs;
CREATE POLICY "Validated api demo logging"
  ON public.api_demo_logs FOR INSERT TO public
  WITH CHECK (ip_address_hash IS NOT NULL AND method IS NOT NULL AND endpoint IS NOT NULL);
