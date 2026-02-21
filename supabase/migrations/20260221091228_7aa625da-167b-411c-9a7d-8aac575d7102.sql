
-- Allow admins to insert profiles (for customer onboarding)
CREATE POLICY "Admins can insert profiles"
ON public.profiles
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to insert account balances (for customer onboarding)
CREATE POLICY "Admins can insert account balances"
ON public.account_balances
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to manage all account balances
CREATE POLICY "Admins can manage account balances"
ON public.account_balances
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));
