-- Add service_role-only RLS policies to OAuth tables for defense-in-depth

-- par_requests: Only service_role can access
CREATE POLICY "Service role full access on par_requests"
  ON public.par_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- authorization_codes: Only service_role can manage, users can view their own
CREATE POLICY "Service role full access on authorization_codes"
  ON public.authorization_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view own authorization codes"
  ON public.authorization_codes
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- access_tokens: Only service_role can manage, users can view their own
CREATE POLICY "Service role full access on access_tokens"
  ON public.access_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view own access tokens"
  ON public.access_tokens
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- refresh_tokens: Only service_role can manage, users can view their own
CREATE POLICY "Service role full access on refresh_tokens"
  ON public.refresh_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view own refresh tokens"
  ON public.refresh_tokens
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());