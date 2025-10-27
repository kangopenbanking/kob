-- Add RLS policies for supported_currencies table
-- This is a reference table that should be readable by all authenticated users
-- but only modifiable by admins

-- Allow all authenticated users to view supported currencies
CREATE POLICY "Anyone can view supported currencies"
ON public.supported_currencies
FOR SELECT
TO authenticated
USING (true);

-- Allow admins to manage supported currencies
CREATE POLICY "Admins can manage supported currencies"
ON public.supported_currencies
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));