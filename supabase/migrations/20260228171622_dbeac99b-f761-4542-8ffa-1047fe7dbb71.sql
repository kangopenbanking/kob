
-- Enable pgcrypto extension for hashing functions
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- ============================================================
-- Security Fix: Hash secret columns & add verification functions
-- ============================================================

-- 1. Add hash columns to all affected tables
ALTER TABLE public.api_credentials ADD COLUMN IF NOT EXISTS api_secret_hash TEXT;
ALTER TABLE public.tpp_registrations ADD COLUMN IF NOT EXISTS client_secret_hash TEXT;
ALTER TABLE public.gateway_merchants ADD COLUMN IF NOT EXISTS webhook_secret_hash TEXT;
ALTER TABLE public.woocommerce_merchants ADD COLUMN IF NOT EXISTS webhook_secret_hash TEXT;

-- 2. Generic SHA-256 hashing function using pgcrypto
CREATE OR REPLACE FUNCTION public.hash_secret_value(secret TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
BEGIN
  RETURN encode(extensions.digest(secret::bytea, 'sha256'), 'hex');
END;
$$;

-- 3. Verification functions (compare hash, never return plaintext)

CREATE OR REPLACE FUNCTION public.verify_api_credential(p_api_key TEXT, p_candidate_secret TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  SELECT api_secret_hash INTO v_hash
  FROM public.api_credentials
  WHERE api_key = p_api_key AND is_active = true;
  
  IF v_hash IS NULL THEN RETURN FALSE; END IF;
  RETURN v_hash = public.hash_secret_value(p_candidate_secret);
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_tpp_client_secret(p_client_id TEXT, p_candidate_secret TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  SELECT client_secret_hash INTO v_hash
  FROM public.tpp_registrations
  WHERE client_id = p_client_id;
  
  IF v_hash IS NULL THEN RETURN FALSE; END IF;
  RETURN v_hash = public.hash_secret_value(p_candidate_secret);
END;
$$;

-- HMAC computation function for webhook signing (plaintext never leaves DB)
CREATE OR REPLACE FUNCTION public.compute_webhook_hmac(p_merchant_id UUID, p_payload TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_secret TEXT;
BEGIN
  SELECT webhook_secret INTO v_secret
  FROM public.gateway_merchants
  WHERE id = p_merchant_id;
  
  IF v_secret IS NULL THEN RETURN NULL; END IF;
  RETURN encode(extensions.hmac(p_payload::bytea, v_secret::bytea, 'sha256'), 'hex');
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_woo_webhook_hmac(p_merchant_id UUID, p_payload TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_secret TEXT;
BEGIN
  SELECT webhook_secret INTO v_secret
  FROM public.woocommerce_merchants
  WHERE id = p_merchant_id;
  
  IF v_secret IS NULL THEN RETURN NULL; END IF;
  RETURN encode(extensions.hmac(p_payload::bytea, v_secret::bytea, 'sha256'), 'hex');
END;
$$;

-- 4. Auto-hash triggers

CREATE OR REPLACE FUNCTION public.auto_hash_api_credential_secret()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
BEGIN
  IF NEW.api_secret IS NOT NULL THEN
    NEW.api_secret_hash = public.hash_secret_value(NEW.api_secret);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hash_api_secret ON public.api_credentials;
CREATE TRIGGER trg_hash_api_secret
  BEFORE INSERT OR UPDATE OF api_secret ON public.api_credentials
  FOR EACH ROW EXECUTE FUNCTION public.auto_hash_api_credential_secret();

CREATE OR REPLACE FUNCTION public.auto_hash_tpp_client_secret()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
BEGIN
  IF NEW.client_secret IS NOT NULL THEN
    NEW.client_secret_hash = public.hash_secret_value(NEW.client_secret);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hash_tpp_secret ON public.tpp_registrations;
CREATE TRIGGER trg_hash_tpp_secret
  BEFORE INSERT OR UPDATE OF client_secret ON public.tpp_registrations
  FOR EACH ROW EXECUTE FUNCTION public.auto_hash_tpp_client_secret();

CREATE OR REPLACE FUNCTION public.auto_hash_gateway_webhook_secret()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
BEGIN
  IF NEW.webhook_secret IS NOT NULL THEN
    NEW.webhook_secret_hash = public.hash_secret_value(NEW.webhook_secret);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hash_gateway_webhook_secret ON public.gateway_merchants;
CREATE TRIGGER trg_hash_gateway_webhook_secret
  BEFORE INSERT OR UPDATE OF webhook_secret ON public.gateway_merchants
  FOR EACH ROW EXECUTE FUNCTION public.auto_hash_gateway_webhook_secret();

DROP TRIGGER IF EXISTS trg_hash_woo_webhook_secret ON public.woocommerce_merchants;
CREATE TRIGGER trg_hash_woo_webhook_secret
  BEFORE INSERT OR UPDATE OF webhook_secret ON public.woocommerce_merchants
  FOR EACH ROW EXECUTE FUNCTION public.auto_hash_gateway_webhook_secret();

-- 5. Backfill existing hashes
UPDATE public.api_credentials SET api_secret_hash = public.hash_secret_value(api_secret) WHERE api_secret IS NOT NULL AND api_secret_hash IS NULL;
UPDATE public.tpp_registrations SET client_secret_hash = public.hash_secret_value(client_secret) WHERE client_secret IS NOT NULL AND client_secret_hash IS NULL;
UPDATE public.gateway_merchants SET webhook_secret_hash = public.hash_secret_value(webhook_secret) WHERE webhook_secret IS NOT NULL AND webhook_secret_hash IS NULL;
UPDATE public.woocommerce_merchants SET webhook_secret_hash = public.hash_secret_value(webhook_secret) WHERE webhook_secret IS NOT NULL AND webhook_secret_hash IS NULL;
