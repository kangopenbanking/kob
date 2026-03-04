-- Allow institution owners and staff to read KYC verifications for their customers
CREATE POLICY "Institution users can view customer KYC"
ON public.kyc_verifications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.user_id = kyc_verifications.user_id
      AND a.is_active = true
      AND (
        EXISTS (SELECT 1 FROM public.institutions i WHERE i.id = a.institution_id AND i.user_id = auth.uid())
        OR
        EXISTS (SELECT 1 FROM public.staff_assignments sa WHERE sa.institution_id = a.institution_id AND sa.user_id = auth.uid() AND sa.is_active = true)
      )
  )
);