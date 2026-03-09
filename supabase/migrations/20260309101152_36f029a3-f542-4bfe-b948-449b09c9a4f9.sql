-- Add staff RLS policy for branches (staff with active assignment can manage branches for their institution)
CREATE POLICY "Staff can manage institution branches"
ON public.branches
FOR ALL
TO authenticated
USING (
  institution_id IN (
    SELECT institution_id FROM public.staff_assignments
    WHERE user_id = auth.uid() AND is_active = true
  )
)
WITH CHECK (
  institution_id IN (
    SELECT institution_id FROM public.staff_assignments
    WHERE user_id = auth.uid() AND is_active = true
  )
);