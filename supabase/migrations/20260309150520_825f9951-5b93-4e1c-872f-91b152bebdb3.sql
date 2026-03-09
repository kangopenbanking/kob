
-- 1. Add api_secret_hash column
ALTER TABLE public.postiq_api_keys ADD COLUMN IF NOT EXISTS api_secret_hash TEXT;

-- 2. Backfill hashes from existing plaintext secrets
UPDATE public.postiq_api_keys 
SET api_secret_hash = public.hash_secret_value(api_secret)
WHERE api_secret IS NOT NULL AND api_secret_hash IS NULL;

-- 3. Create trigger to auto-hash on insert/update
CREATE OR REPLACE FUNCTION public.auto_hash_postiq_api_secret()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NEW.api_secret IS NOT NULL THEN
    NEW.api_secret_hash = public.hash_secret_value(NEW.api_secret);
    -- Clear plaintext after hashing
    NEW.api_secret = NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_hash_postiq_api_secret
  BEFORE INSERT OR UPDATE ON public.postiq_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_hash_postiq_api_secret();

-- 4. Drop the plaintext api_secret column
ALTER TABLE public.postiq_api_keys DROP COLUMN api_secret;

-- 5. Make api_secret_hash NOT NULL now that it's backfilled
ALTER TABLE public.postiq_api_keys ALTER COLUMN api_secret_hash SET NOT NULL;

-- 6. Create verify function
CREATE OR REPLACE FUNCTION public.verify_postiq_credential(_institution_id uuid, _api_key text, _api_secret text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_stored_hash TEXT;
BEGIN
  SELECT api_secret_hash INTO v_stored_hash
  FROM public.postiq_api_keys
  WHERE institution_id = _institution_id
    AND api_key = _api_key
    AND is_active = true;
  
  IF v_stored_hash IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN v_stored_hash = public.hash_secret_value(_api_secret);
END;
$$;
