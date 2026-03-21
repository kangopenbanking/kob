
CREATE OR REPLACE FUNCTION public.get_profile_phone(_profile_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT phone_number FROM public.profiles WHERE id = _profile_id;
$$;
