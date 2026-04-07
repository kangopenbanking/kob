-- Drop the recursive policies
DROP POLICY IF EXISTS "Bill owners can view all participants" ON public.split_bill_participants;
DROP POLICY IF EXISTS "Participants can view bills they are in" ON public.split_bills;

-- Create a security definer function to check bill ownership
CREATE OR REPLACE FUNCTION public.is_split_bill_owner(_user_id uuid, _bill_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.split_bills
    WHERE id = _bill_id AND user_id = _user_id
  )
$$;

-- Create a security definer function to check if user is a participant
CREATE OR REPLACE FUNCTION public.is_split_bill_participant(_user_id uuid, _bill_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.split_bill_participants
    WHERE split_bill_id = _bill_id AND user_id = _user_id
  )
$$;

-- Recreate participant policy: bill owners can see all participants (no recursion)
CREATE POLICY "Bill owners can view all participants"
ON public.split_bill_participants
FOR SELECT
TO authenticated
USING (public.is_split_bill_owner(auth.uid(), split_bill_id));

-- Recreate split_bills policy: participants can view bills they are in (no recursion)
CREATE POLICY "Participants can view bills they are in"
ON public.split_bills
FOR SELECT
TO authenticated
USING (public.is_split_bill_participant(auth.uid(), id));