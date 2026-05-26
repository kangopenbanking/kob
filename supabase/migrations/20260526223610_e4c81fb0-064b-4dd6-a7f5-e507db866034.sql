ALTER TABLE public.customer_linked_accounts
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_provider text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS external_bank_code text,
  ADD COLUMN IF NOT EXISTS external_account_ref text,
  ADD COLUMN IF NOT EXISTS verification_reference text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customer_linked_accounts_verification_status_check'
      AND conrelid = 'public.customer_linked_accounts'::regclass
  ) THEN
    ALTER TABLE public.customer_linked_accounts
      ADD CONSTRAINT customer_linked_accounts_verification_status_check
      CHECK (verification_status IN ('unverified', 'verified', 'verification_failed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customer_linked_accounts_bank_verified_check'
      AND conrelid = 'public.customer_linked_accounts'::regclass
  ) THEN
    ALTER TABLE public.customer_linked_accounts
      ADD CONSTRAINT customer_linked_accounts_bank_verified_check
      CHECK (
        NOT (account_type = 'bank_account' AND is_active = true AND status = 'active')
        OR (
          verification_status = 'verified'
          AND verification_provider IN ('kob', 'flutterwave')
          AND verified_at IS NOT NULL
          AND external_bank_code IS NOT NULL
          AND external_account_ref IS NOT NULL
        )
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_linked_accounts_verified_bank_unique
  ON public.customer_linked_accounts(user_id, verification_provider, external_bank_code, external_account_ref)
  WHERE account_type = 'bank_account'
    AND is_active = true
    AND status = 'active'
    AND verification_status = 'verified';

DROP POLICY IF EXISTS "Users can insert own linked accounts" ON public.customer_linked_accounts;

CREATE POLICY "Users can insert own non-bank linked accounts"
  ON public.customer_linked_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND account_type <> 'bank_account'
  );

GRANT SELECT, INSERT, UPDATE ON public.customer_linked_accounts TO authenticated;
GRANT ALL ON public.customer_linked_accounts TO service_role;