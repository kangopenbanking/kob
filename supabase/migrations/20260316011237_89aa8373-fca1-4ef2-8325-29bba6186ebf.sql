-- Fix admin SELECT policy to use SECURITY DEFINER has_role() to avoid recursive RLS
DROP POLICY IF EXISTS "Admins can view all business KYC" ON public.business_kyc;
CREATE POLICY "Admins can view all business KYC"
  ON public.business_kyc FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Fix admin UPDATE policy to use has_role() as well
DROP POLICY IF EXISTS "Admins can update business KYC verification" ON public.business_kyc;
CREATE POLICY "Admins can update business KYC verification"
  ON public.business_kyc FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Also allow FI staff to view KYB submissions for their institution users
DROP POLICY IF EXISTS "FI staff can view their institution KYB" ON public.business_kyc;
CREATE POLICY "FI staff can view their institution KYB"
  ON public.business_kyc FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.institutions i
      JOIN public.staff_assignments sa ON sa.institution_id = i.id
      WHERE i.user_id = business_kyc.user_id
        AND sa.user_id = auth.uid()
        AND sa.is_active = true
    )
  );