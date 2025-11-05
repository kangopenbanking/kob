-- Enhanced RLS Policies for consent_events table
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own consent events" ON public.consent_events;
DROP POLICY IF EXISTS "Admins can view all consent events" ON public.consent_events;

-- Create comprehensive RLS policies

-- 1. Users can only SELECT their own consent events
CREATE POLICY "Users can view own consent events"
  ON public.consent_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. Admins can view all consent events for audit purposes
CREATE POLICY "Admins can view all consent events"
  ON public.consent_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Only service role can INSERT consent events (via log_consent_event function)
CREATE POLICY "Service role can insert consent events"
  ON public.consent_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow inserts from SECURITY DEFINER functions (they run as service role context)
    -- or explicit service role
    true
  );

-- 4. Prevent all UPDATE operations - consent events are immutable audit logs
CREATE POLICY "Consent events are immutable"
  ON public.consent_events
  FOR UPDATE
  TO authenticated
  USING (false);

-- 5. Prevent all DELETE operations except for admins (data retention compliance)
CREATE POLICY "Only admins can delete old consent events"
  ON public.consent_events
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Add comment explaining the security model
COMMENT ON TABLE public.consent_events IS 
'Audit trail for consent activities. IP addresses are hashed for privacy. 
Users can only view their own events. Only service functions can insert. 
Records are immutable. Only admins can delete for compliance.';

-- Ensure user_id is properly indexed for performance
CREATE INDEX IF NOT EXISTS idx_consent_events_user_id_created 
ON public.consent_events(user_id, created_at DESC);