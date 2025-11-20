-- Fix search_path for create_initial_verification_steps function
-- This addresses the Supabase linter warning about mutable search paths

DROP FUNCTION IF EXISTS create_initial_verification_steps() CASCADE;

CREATE OR REPLACE FUNCTION create_initial_verification_steps()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create the verification steps
  INSERT INTO institution_verification_steps (institution_id, step_name, step_type, status)
  VALUES
    (NEW.id, 'Institution Registration', 'registration', 'completed'),
    (NEW.id, 'Business KYC Submission', 'kyb_submission', 'pending'),
    (NEW.id, 'KYB Verification', 'kyb_verification', 'pending'),
    (NEW.id, 'Main Branch Creation', 'branch_creation', 'pending'),
    (NEW.id, 'Final Approval', 'final_approval', 'pending');
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS create_initial_verification_steps_trigger ON institutions;

CREATE TRIGGER create_initial_verification_steps_trigger
  AFTER INSERT ON institutions
  FOR EACH ROW
  EXECUTE FUNCTION create_initial_verification_steps();