-- Allow users to update their own account balances (through account ownership)
CREATE POLICY "Users can update own account balances"
ON public.account_balances
FOR UPDATE
TO authenticated
USING (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()))
WITH CHECK (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()));

-- Allow users to insert their own account balances
CREATE POLICY "Users can insert own account balances"
ON public.account_balances
FOR INSERT
TO authenticated
WITH CHECK (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()));