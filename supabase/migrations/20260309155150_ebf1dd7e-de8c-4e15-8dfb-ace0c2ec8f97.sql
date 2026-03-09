
-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view sandbox accounts" ON public.sandbox_accounts;

-- Create a scoped SELECT policy: users can only see their own sandbox accounts
CREATE POLICY "Users can view own sandbox accounts"
ON public.sandbox_accounts
FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- Admins can view all sandbox accounts (via service role in edge functions)
CREATE POLICY "Admins can view all sandbox accounts"
ON public.sandbox_accounts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
