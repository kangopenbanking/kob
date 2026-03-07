CREATE POLICY "Authenticated users can read active fee structures"
ON public.fee_structures
FOR SELECT
TO authenticated
USING (is_active = true);