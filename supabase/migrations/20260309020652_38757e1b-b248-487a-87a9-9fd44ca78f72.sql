
-- Add missing enterprise columns to gateway_merchants
ALTER TABLE public.gateway_merchants 
  ADD COLUMN IF NOT EXISTS branding_config jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS white_label_config jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS custom_domain text,
  ADD COLUMN IF NOT EXISTS api_keys_count integer NOT NULL DEFAULT 0;

-- Create gateway_merchant_keys table
CREATE TABLE IF NOT EXISTS public.gateway_merchant_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  label text,
  public_key text NOT NULL,
  secret_key_hash text,
  environment text NOT NULL DEFAULT 'sandbox',
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gateway_merchant_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants manage own keys" ON public.gateway_merchant_keys
  FOR ALL USING (
    merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid())
  );

-- Create gateway_bulk_operations table
CREATE TABLE IF NOT EXISTS public.gateway_bulk_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  total_records integer NOT NULL DEFAULT 0,
  processed_records integer NOT NULL DEFAULT 0,
  failed_records integer NOT NULL DEFAULT 0,
  file_name text,
  error_details jsonb,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.gateway_bulk_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants manage own bulk ops" ON public.gateway_bulk_operations
  FOR ALL USING (
    merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid())
  );
