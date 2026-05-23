
ALTER TABLE public.savings_vaults
  ADD COLUMN IF NOT EXISTS daily_withdrawal_limit NUMERIC(14,2) NOT NULL DEFAULT 100000,
  ADD COLUMN IF NOT EXISTS monthly_withdrawal_limit NUMERIC(14,2) NOT NULL DEFAULT 1000000;

ALTER TABLE public.vault_transactions
  ADD COLUMN IF NOT EXISTS reference_code TEXT;

CREATE OR REPLACE FUNCTION public.gen_vault_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.reference_code IS NULL THEN
    NEW.reference_code := 'VLT-' || to_char(now(), 'YYMMDD') || '-' ||
      upper(substr(replace(NEW.id::text, '-', ''), 1, 8));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vault_tx_reference ON public.vault_transactions;
CREATE TRIGGER trg_vault_tx_reference
  BEFORE INSERT ON public.vault_transactions
  FOR EACH ROW EXECUTE FUNCTION public.gen_vault_reference();

CREATE INDEX IF NOT EXISTS idx_vault_tx_reference_code
  ON public.vault_transactions (reference_code);
