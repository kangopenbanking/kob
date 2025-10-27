-- Add password validation function as an additional security layer
-- Note: Leaked password protection should also be enabled in Supabase Dashboard > Authentication > Policies

-- Create secure password validation function
CREATE OR REPLACE FUNCTION public.validate_password_strength(password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check password length (min 8 characters)
  IF LENGTH(password) < 8 THEN
    RETURN FALSE;
  END IF;
  
  -- Check for at least one uppercase letter
  IF password !~ '[A-Z]' THEN
    RETURN FALSE;
  END IF;
  
  -- Check for at least one lowercase letter
  IF password !~ '[a-z]' THEN
    RETURN FALSE;
  END IF;
  
  -- Check for at least one number
  IF password !~ '[0-9]' THEN
    RETURN FALSE;
  END IF;
  
  -- Check for at least one special character
  IF password !~ '[!@#$%^&*()_+\-=\[\]{};:''",.<>?/|\\]' THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.validate_password_strength IS 'Validates password meets security requirements: 8+ chars, uppercase, lowercase, number, special character. Note: Leaked password protection should also be enabled in Supabase Dashboard > Authentication > Policies.';