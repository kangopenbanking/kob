-- Add 'developer' to institution_type enum
ALTER TYPE institution_type ADD VALUE IF NOT EXISTS 'developer';

-- Add sandbox_access field to institutions table
ALTER TABLE institutions 
ADD COLUMN IF NOT EXISTS sandbox_access boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Add index for faster status queries
CREATE INDEX IF NOT EXISTS idx_institutions_status ON institutions(status);
CREATE INDEX IF NOT EXISTS idx_institutions_user_id ON institutions(user_id);