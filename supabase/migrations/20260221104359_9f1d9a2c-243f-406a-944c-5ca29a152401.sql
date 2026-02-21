
-- Add 'staff' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';

-- Create staff_portal_permissions table
CREATE TABLE public.staff_portal_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_assignment_id uuid NOT NULL REFERENCES public.staff_assignments(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  can_view boolean DEFAULT true,
  can_manage boolean DEFAULT false,
  granted_by uuid,
  granted_at timestamptz DEFAULT now(),
  UNIQUE(staff_assignment_id, section_key)
);

-- Enable RLS
ALTER TABLE public.staff_portal_permissions ENABLE ROW LEVEL SECURITY;

-- Helper: check if user is institution owner
CREATE OR REPLACE FUNCTION public.is_institution_owner(_user_id uuid, _institution_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.institutions
    WHERE user_id = _user_id AND id = _institution_id
  )
$$;

-- Helper: get staff portal sections for a user
CREATE OR REPLACE FUNCTION public.get_staff_portal_sections(_user_id uuid)
RETURNS TABLE(section_key text, can_view boolean, can_manage boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT spp.section_key, spp.can_view, spp.can_manage
  FROM public.staff_portal_permissions spp
  JOIN public.staff_assignments sa ON sa.id = spp.staff_assignment_id
  WHERE sa.user_id = _user_id AND sa.is_active = true
$$;

-- RLS: Institution owners/admins can manage permissions
CREATE POLICY "Institution owners can manage staff permissions"
ON public.staff_portal_permissions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.staff_assignments sa
    WHERE sa.id = staff_assignment_id
    AND (
      public.is_institution_owner(auth.uid(), sa.institution_id)
      OR public.has_role(auth.uid(), 'admin')
      OR public.is_institution_staff_admin(auth.uid(), sa.institution_id)
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.staff_assignments sa
    WHERE sa.id = staff_assignment_id
    AND (
      public.is_institution_owner(auth.uid(), sa.institution_id)
      OR public.has_role(auth.uid(), 'admin')
      OR public.is_institution_staff_admin(auth.uid(), sa.institution_id)
    )
  )
);

-- RLS: Staff can view their own permissions
CREATE POLICY "Staff can view own permissions"
ON public.staff_portal_permissions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.staff_assignments sa
    WHERE sa.id = staff_assignment_id AND sa.user_id = auth.uid()
  )
);
