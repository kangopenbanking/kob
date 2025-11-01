-- Add personal role to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'personal';

-- Function to auto-assign personal role to new users without institutions
CREATE OR REPLACE FUNCTION public.assign_default_personal_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Wait a moment to ensure profiles table is populated
  PERFORM pg_sleep(0.1);
  
  -- Check if user doesn't have an institution record
  IF NOT EXISTS (
    SELECT 1 FROM public.institutions WHERE user_id = NEW.id
  ) THEN
    -- Check if user doesn't already have admin, tpp, or institution role
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = NEW.id 
      AND role IN ('admin', 'tpp', 'institution')
    ) THEN
      -- Assign personal role by default
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'personal')
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-assign role on profile creation (after user is created)
DROP TRIGGER IF EXISTS on_profile_created_assign_personal_role ON public.profiles;
CREATE TRIGGER on_profile_created_assign_personal_role
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_default_personal_role();