
-- =============================================
-- BATCH 5: Fix all remaining permissive RLS policies & broken conditions
-- =============================================

-- ============================================================
-- 1. CRITICAL: Policies on {public} role with USING(true) / WITH CHECK(true)
--    These expose data to anonymous (unauthenticated) users.
--    Fix: Drop and recreate scoped to {service_role}
-- ============================================================

-- 1a. funding_intents: "Service role full access funding intents"
DROP POLICY IF EXISTS "Service role full access funding intents" ON public.funding_intents;
CREATE POLICY "Service role full access funding intents"
  ON public.funding_intents FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 1b. funding_events: "Service role full access funding events"
DROP POLICY IF EXISTS "Service role full access funding events" ON public.funding_events;
CREATE POLICY "Service role full access funding events"
  ON public.funding_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 1c. external_credit_data_cache: "System can manage cache"
DROP POLICY IF EXISTS "System can manage cache" ON public.external_credit_data_cache;
CREATE POLICY "Service role manage cache"
  ON public.external_credit_data_cache FOR ALL TO service_role
  USING (true) WITH CHECK (true);
-- Add user-scoped read for their own cache
CREATE POLICY "Users can view own cached data"
  ON public.external_credit_data_cache FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 1d. webhook_inbox: "Service role full access on webhook_inbox"
DROP POLICY IF EXISTS "Service role full access on webhook_inbox" ON public.webhook_inbox;
CREATE POLICY "Service role full access on webhook_inbox"
  ON public.webhook_inbox FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 1e. idempotency_keys: "Service role full access on idempotency_keys"
DROP POLICY IF EXISTS "Service role full access on idempotency_keys" ON public.idempotency_keys;
CREATE POLICY "Service role full access on idempotency_keys"
  ON public.idempotency_keys FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 1f. credit_scores: INSERT and UPDATE on {public} with true
DROP POLICY IF EXISTS "System can create credit scores" ON public.credit_scores;
CREATE POLICY "Service role can create credit scores"
  ON public.credit_scores FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "System can update credit scores" ON public.credit_scores;
CREATE POLICY "Service role can update credit scores"
  ON public.credit_scores FOR UPDATE TO service_role
  USING (true);

-- 1g. credit_inquiries: "System can create inquiries"
DROP POLICY IF EXISTS "System can create inquiries" ON public.credit_inquiries;
CREATE POLICY "Service role can create inquiries"
  ON public.credit_inquiries FOR INSERT TO service_role
  WITH CHECK (true);

-- 1h. credit_reports: "System can create credit reports"
DROP POLICY IF EXISTS "System can create credit reports" ON public.credit_reports;
CREATE POLICY "Service role can create credit reports"
  ON public.credit_reports FOR INSERT TO service_role
  WITH CHECK (true);

-- 1i. credit_score_history: "System can create history"
DROP POLICY IF EXISTS "System can create history" ON public.credit_score_history;
CREATE POLICY "Service role can create history"
  ON public.credit_score_history FOR INSERT TO service_role
  WITH CHECK (true);

-- 1j. credit_monitoring_alerts: "System can create alerts"
DROP POLICY IF EXISTS "System can create alerts" ON public.credit_monitoring_alerts;
CREATE POLICY "Service role can create alerts"
  ON public.credit_monitoring_alerts FOR INSERT TO service_role
  WITH CHECK (true);

-- ============================================================
-- 2. BROKEN SELF-REFERENTIAL POLICIES
-- ============================================================

-- 2a. njangi_contributions: nm.group_id = nm.group_id (always true)
DROP POLICY IF EXISTS "Members can read njangi contributions" ON public.njangi_contributions;
CREATE POLICY "Members can read njangi contributions"
  ON public.njangi_contributions FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM njangi_members nm
      WHERE nm.group_id = njangi_contributions.group_id
        AND nm.user_id = auth.uid()
        AND nm.status = 'active'
    )
  );

-- 2b. njangi_payouts: nm.group_id = nm.group_id (always true)
DROP POLICY IF EXISTS "Members can read njangi payouts" ON public.njangi_payouts;
CREATE POLICY "Members can read njangi payouts"
  ON public.njangi_payouts FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM njangi_members nm
      WHERE nm.group_id = njangi_payouts.group_id
        AND nm.user_id = auth.uid()
        AND nm.status = 'active'
    )
  );

-- 2c. pos_products: sp.merchant_id = sp.merchant_id (always true)
DROP POLICY IF EXISTS "Consumers can view products of published stores" ON public.pos_products;
CREATE POLICY "Consumers can view products of published stores"
  ON public.pos_products FOR SELECT TO authenticated
  USING (
    status = 'active'
    AND EXISTS (
      SELECT 1 FROM pos_store_profiles sp
      WHERE sp.merchant_id = pos_products.merchant_id
        AND sp.is_published = true
    )
  );

-- ============================================================
-- 3. FUNCTION SEARCH PATH FIX
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_pos_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $func$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$func$;
