-- 1. Drop the not-null constraint, scrub data, then drop the column
ALTER TABLE public.signing_keys ALTER COLUMN private_key DROP NOT NULL;
UPDATE public.signing_keys SET private_key = NULL;
ALTER TABLE public.signing_keys DROP COLUMN private_key;
COMMENT ON TABLE public.signing_keys IS
  'Public JWK material only (n, e, kid, alg, use, kty). Private key material must be stored in Supabase Vault or an external KMS and loaded at signing time — never inserted into this table.';

-- 2. transactions: remove user DELETE policy (ledger immutability)
DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;

-- 3. fee_limits_charges: restrict broad SELECT to admins only
DROP POLICY IF EXISTS "Authenticated users can read fee_limits_charges" ON public.fee_limits_charges;

CREATE POLICY "Admins can read fee_limits_charges"
  ON public.fee_limits_charges
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));