-- Fix RLS security warnings for Phase 1 tables
-- These tables are managed exclusively by edge functions
-- Add restrictive policies to make security explicit

-- PAR requests: Only edge functions should access (no direct user access)
CREATE POLICY "No direct user access to PAR requests"
  ON public.par_requests FOR ALL
  USING (FALSE)
  WITH CHECK (FALSE);

-- Authorization codes: Only edge functions should access
CREATE POLICY "No direct user access to authorization codes"
  ON public.authorization_codes FOR ALL
  USING (FALSE)
  WITH CHECK (FALSE);

-- Access tokens: Only edge functions should access
CREATE POLICY "No direct user access to access tokens"
  ON public.access_tokens FOR ALL
  USING (FALSE)
  WITH CHECK (FALSE);

-- Refresh tokens: Only edge functions should access
CREATE POLICY "No direct user access to refresh tokens"
  ON public.refresh_tokens FOR ALL
  USING (FALSE)
  WITH CHECK (FALSE);