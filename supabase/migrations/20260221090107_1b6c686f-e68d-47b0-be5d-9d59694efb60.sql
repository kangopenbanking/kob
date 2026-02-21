-- Fix infinite recursion in staff_assignments RLS policies
-- The issue: policies query staff_assignments itself to check admin status

-- Step 1: Create a security definer function to check institution staff admin status
CREATE OR REPLACE FUNCTION public.is_institution_staff_admin(_user_id uuid, _institution_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_assignments
    WHERE user_id = _user_id
      AND institution_id = _institution_id
      AND position ILIKE '%admin%'
      AND is_active = true
  )
$$;

-- Also create a function to get user's institution_id from staff_assignments
CREATE OR REPLACE FUNCTION public.get_staff_institution_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT institution_id FROM public.staff_assignments
  WHERE user_id = _user_id AND is_active = true
  LIMIT 1
$$;

-- Step 2: Drop the recursive policies
DROP POLICY IF EXISTS "Institution admins can view their staff" ON public.staff_assignments;
DROP POLICY IF EXISTS "Institution admins can create staff assignments" ON public.staff_assignments;

-- Step 3: Recreate with security definer functions
-- Institution users who are institution owners (from institutions table) can manage staff
CREATE POLICY "Institution owners can view staff" ON public.staff_assignments
FOR SELECT USING (
  institution_id IN (SELECT id FROM public.institutions WHERE user_id = auth.uid())
  OR user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

-- Drop old user self-view policy to avoid conflicts
DROP POLICY IF EXISTS "Users can view own assignments" ON public.staff_assignments;

CREATE POLICY "Institution owners can insert staff" ON public.staff_assignments
FOR INSERT WITH CHECK (
  institution_id IN (SELECT id FROM public.institutions WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Institution owners can update staff" ON public.staff_assignments
FOR UPDATE USING (
  institution_id IN (SELECT id FROM public.institutions WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Institution owners can delete staff" ON public.staff_assignments
FOR DELETE USING (
  institution_id IN (SELECT id FROM public.institutions WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- Keep the admin policy
DROP POLICY IF EXISTS "Admins can manage all staff assignments" ON public.staff_assignments;