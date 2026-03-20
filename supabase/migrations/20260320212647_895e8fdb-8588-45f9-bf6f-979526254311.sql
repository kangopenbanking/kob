
ALTER TABLE public.gateway_merchants
  ADD COLUMN IF NOT EXISTS domain_verification_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS domain_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS domain_ssl_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS domain_cname_target text DEFAULT 'checkout.kangopenbanking.com';
