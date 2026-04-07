-- Allow participants to SELECT split bills they're part of
CREATE POLICY "Participants can view bills they are in"
ON public.split_bills
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT split_bill_id FROM public.split_bill_participants
    WHERE user_id = auth.uid()
  )
);

-- Allow participants to SELECT their own participant records
CREATE POLICY "Participants can view own records"
ON public.split_bill_participants
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Allow participants to UPDATE their own record (for paid status)
CREATE POLICY "Participants can update own records"
ON public.split_bill_participants
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());