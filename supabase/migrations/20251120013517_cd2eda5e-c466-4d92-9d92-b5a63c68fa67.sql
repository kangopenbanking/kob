-- Fix institution_verification_steps RLS policies
-- Split the overly permissive FOR ALL policy into granular policies

-- Drop the existing broad FOR ALL policy
DROP POLICY IF EXISTS "Admins can manage verification steps" ON institution_verification_steps;

-- Create granular policies for INSERT, UPDATE (no DELETE to preserve audit trail)

-- Allow admins to insert new verification steps
CREATE POLICY "Admins can insert verification steps"
  ON institution_verification_steps FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update verification steps
CREATE POLICY "Admins can update verification steps"
  ON institution_verification_steps FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- No DELETE policy - preserve audit trail by design
-- If deletion is truly needed, it should be done via direct database access with proper authorization

-- Add comment explaining the security design
COMMENT ON TABLE institution_verification_steps IS 'Audit trail for institution verification process. DELETE operations restricted to preserve compliance records. Admins can UPDATE status but cannot DELETE records.';