-- Add admin role for testing (insert your user ID)
-- This is a helper function to make a user an admin
-- Usage: SELECT make_user_admin('user-uuid-here');

CREATE OR REPLACE FUNCTION public.make_user_admin(_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.make_user_admin TO authenticated;