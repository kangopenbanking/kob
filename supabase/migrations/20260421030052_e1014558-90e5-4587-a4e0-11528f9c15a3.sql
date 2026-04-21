-- Add merchant_id to developer_sandbox_accounts (one per account)
ALTER TABLE public.developer_sandbox_accounts
  ADD COLUMN IF NOT EXISTS merchant_id text UNIQUE;

-- Backfill merchant_id for any existing sandbox accounts
UPDATE public.developer_sandbox_accounts
SET merchant_id = 'merch_sbx_' || encode(gen_random_bytes(8), 'hex')
WHERE merchant_id IS NULL;

-- Auto-generate merchant_id for new rows
CREATE OR REPLACE FUNCTION public.set_sandbox_merchant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.merchant_id IS NULL THEN
    NEW.merchant_id := 'merch_sbx_' || encode(gen_random_bytes(8), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_sandbox_merchant_id ON public.developer_sandbox_accounts;
CREATE TRIGGER trg_set_sandbox_merchant_id
  BEFORE INSERT ON public.developer_sandbox_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_sandbox_merchant_id();

-- Extend sandbox_api_keys: rename api_key -> secret_key conceptually by adding new columns,
-- and add publishable_key + webhook_secret. Keep existing api_key column for backward compatibility.
ALTER TABLE public.sandbox_api_keys
  ADD COLUMN IF NOT EXISTS publishable_key text,
  ADD COLUMN IF NOT EXISTS webhook_secret_hash text,
  ADD COLUMN IF NOT EXISTS webhook_secret_preview text;

-- Index for publishable key lookups
CREATE INDEX IF NOT EXISTS idx_sandbox_api_keys_pub
  ON public.sandbox_api_keys (publishable_key)
  WHERE publishable_key IS NOT NULL;