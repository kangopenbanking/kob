
-- BEAC PoP code lock + cascade default payout method (additive)
-- Cites: BEAC Règlement 02/18/CEMAC/UMAC/CM (Purpose of Payment requirement)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_payout_method text;

UPDATE public.profiles
  SET default_payout_method = COALESCE(default_payout_method, payout_preference, 'KANG_WALLET')
  WHERE default_payout_method IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN default_payout_method SET DEFAULT 'KANG_WALLET',
  ALTER COLUMN default_payout_method SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_default_payout_method_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_default_payout_method_check
      CHECK (default_payout_method IN ('KANG_WALLET','MOBILE_MONEY'));
  END IF;
END $$;

ALTER TABLE public.nium_global_accounts
  ADD COLUMN IF NOT EXISTS pop_code text NOT NULL DEFAULT 'Software/Digital Services';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nium_global_accounts_pop_code_check'
  ) THEN
    ALTER TABLE public.nium_global_accounts
      ADD CONSTRAINT nium_global_accounts_pop_code_check
      CHECK (pop_code IN ('Software/Digital Services','Royalties'));
  END IF;
END $$;

ALTER TABLE public.nium_incoming_payments
  ADD COLUMN IF NOT EXISTS pop_code text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nium_incoming_payments_pop_code_check'
  ) THEN
    ALTER TABLE public.nium_incoming_payments
      ADD CONSTRAINT nium_incoming_payments_pop_code_check
      CHECK (pop_code IS NULL OR pop_code IN ('Software/Digital Services','Royalties'));
  END IF;
END $$;
