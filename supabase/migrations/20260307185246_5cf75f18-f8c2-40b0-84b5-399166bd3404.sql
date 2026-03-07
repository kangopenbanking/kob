-- Drop plaintext secret columns with CASCADE to remove dependent triggers
ALTER TABLE public.api_credentials DROP COLUMN IF EXISTS api_secret CASCADE;
ALTER TABLE public.tpp_registrations DROP COLUMN IF EXISTS client_secret CASCADE;
ALTER TABLE public.woocommerce_merchants DROP COLUMN IF EXISTS webhook_secret CASCADE;

-- Clean up orphaned trigger functions
DROP FUNCTION IF EXISTS public.auto_hash_api_credential_secret() CASCADE;
DROP FUNCTION IF EXISTS public.auto_hash_tpp_client_secret() CASCADE;
DROP FUNCTION IF EXISTS public.auto_hash_gateway_webhook_secret() CASCADE;