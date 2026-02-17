-- Fix: Restrict woocommerce_transactions to service_role only
-- Transactions should only be managed by edge functions using SERVICE_ROLE_KEY

DROP POLICY IF EXISTS "System can insert transactions" ON woocommerce_transactions;
DROP POLICY IF EXISTS "System can update transactions" ON woocommerce_transactions;

CREATE POLICY "Service role manages transactions"
ON woocommerce_transactions FOR ALL
TO service_role
USING (true) WITH CHECK (true);
