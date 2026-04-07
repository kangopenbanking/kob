-- Allow bill owners to see all participants of their bills
CREATE POLICY "Bill owners can view all participants"
ON public.split_bill_participants
FOR SELECT
TO authenticated
USING (
  split_bill_id IN (
    SELECT id FROM public.split_bills WHERE user_id = auth.uid()
  )
);

-- Fix existing owner participant records with null user_id
UPDATE public.split_bill_participants p
SET user_id = b.user_id
FROM public.split_bills b
WHERE p.split_bill_id = b.id
  AND p.is_owner = true
  AND p.user_id IS NULL;