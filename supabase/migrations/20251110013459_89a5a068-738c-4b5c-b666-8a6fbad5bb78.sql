-- Add verification tracking columns to institutions table
ALTER TABLE institutions 
ADD COLUMN IF NOT EXISTS verification_step TEXT DEFAULT 'pending_registration',
ADD COLUMN IF NOT EXISTS kyb_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS kyb_verified_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS main_branch_id UUID REFERENCES branches(id),
ADD COLUMN IF NOT EXISTS kyb_submission_id UUID REFERENCES business_kyc(id);

-- Add comments for clarity
COMMENT ON COLUMN institutions.verification_step IS 'Tracks institution verification progress: pending_registration, pending_kyb, kyb_submitted, kyb_approved, pending_branch, approved, rejected';
COMMENT ON COLUMN institutions.kyb_verified_at IS 'Timestamp when KYB was verified by admin';
COMMENT ON COLUMN institutions.kyb_verified_by IS 'Admin user who verified the KYB';
COMMENT ON COLUMN institutions.main_branch_id IS 'Reference to the main/head office branch';
COMMENT ON COLUMN institutions.kyb_submission_id IS 'Reference to the business KYC submission';

-- Create institution verification steps tracking table
CREATE TABLE IF NOT EXISTS institution_verification_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  step_type TEXT NOT NULL, -- 'registration', 'kyb_submission', 'kyb_verification', 'branch_creation', 'final_approval'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed', 'skipped'
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_institution_verification_steps_institution_id 
  ON institution_verification_steps(institution_id);
CREATE INDEX IF NOT EXISTS idx_institution_verification_steps_status 
  ON institution_verification_steps(status);
CREATE INDEX IF NOT EXISTS idx_institutions_verification_step 
  ON institutions(verification_step);

-- Enable RLS on institution_verification_steps
ALTER TABLE institution_verification_steps ENABLE ROW LEVEL SECURITY;

-- RLS Policies for institution_verification_steps
CREATE POLICY "Admins can view all verification steps"
  ON institution_verification_steps FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage verification steps"
  ON institution_verification_steps FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Institutions can view own verification steps"
  ON institution_verification_steps FOR SELECT
  USING (institution_id IN (
    SELECT id FROM institutions WHERE user_id = auth.uid()
  ));

-- Add trigger for updated_at
CREATE TRIGGER update_institution_verification_steps_updated_at
  BEFORE UPDATE ON institution_verification_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create initial verification steps for new institutions
CREATE OR REPLACE FUNCTION create_initial_verification_steps()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-create verification steps
DROP TRIGGER IF EXISTS create_verification_steps_on_institution_insert ON institutions;
CREATE TRIGGER create_verification_steps_on_institution_insert
  AFTER INSERT ON institutions
  FOR EACH ROW
  EXECUTE FUNCTION create_initial_verification_steps();