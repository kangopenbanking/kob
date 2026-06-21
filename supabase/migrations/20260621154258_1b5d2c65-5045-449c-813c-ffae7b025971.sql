-- account_balances: remove user-facing write policies (admins + service_role retain access)
DROP POLICY IF EXISTS "Users can insert own account balances" ON public.account_balances;
DROP POLICY IF EXISTS "Users can update own account balances" ON public.account_balances;

-- transactions: remove user-facing write policies (admins + service_role retain access)
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;