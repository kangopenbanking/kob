-- Fix njangi_members infinite recursion: create a security definer function
CREATE OR REPLACE FUNCTION public.is_njangi_group_member(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.njangi_members
    WHERE user_id = _user_id AND group_id = _group_id AND status = 'active'
  )
$$;

-- Drop the recursive policy
DROP POLICY IF EXISTS "Members can read njangi members" ON public.njangi_members;

-- Recreate without self-reference
CREATE POLICY "Members can read njangi members"
ON public.njangi_members
FOR SELECT
USING (
  user_id = auth.uid()
  OR public.is_njangi_group_member(auth.uid(), group_id)
);