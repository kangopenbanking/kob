
-- Gateway Merchant API Keys (per environment)
CREATE TABLE public.gateway_merchant_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  api_key_prefix TEXT NOT NULL,
  api_key_hash TEXT NOT NULL,
  label TEXT,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(api_key_prefix)
);

ALTER TABLE public.gateway_merchant_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view own API keys" ON public.gateway_merchant_api_keys
  FOR SELECT USING (
    merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid())
  );

CREATE POLICY "Merchants can create own API keys" ON public.gateway_merchant_api_keys
  FOR INSERT WITH CHECK (
    merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid())
  );

CREATE POLICY "Merchants can update own API keys" ON public.gateway_merchant_api_keys
  FOR UPDATE USING (
    merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid())
  );

CREATE POLICY "Merchants can delete own API keys" ON public.gateway_merchant_api_keys
  FOR DELETE USING (
    merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role full access to merchant API keys" ON public.gateway_merchant_api_keys
  FOR ALL USING (auth.role() = 'service_role');

-- Add limit columns to gateway_merchants
ALTER TABLE public.gateway_merchants
  ADD COLUMN IF NOT EXISTS daily_charge_limit NUMERIC DEFAULT 5000000,
  ADD COLUMN IF NOT EXISTS single_charge_limit NUMERIC DEFAULT 1000000,
  ADD COLUMN IF NOT EXISTS daily_payout_limit NUMERIC DEFAULT 2000000,
  ADD COLUMN IF NOT EXISTS monthly_volume_limit NUMERIC DEFAULT 50000000,
  ADD COLUMN IF NOT EXISTS velocity_window_minutes INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS velocity_max_charges INTEGER DEFAULT 20;

-- Index for API key lookups
CREATE INDEX idx_gateway_merchant_api_keys_prefix ON public.gateway_merchant_api_keys(api_key_prefix) WHERE is_active = true;
CREATE INDEX idx_gateway_merchant_api_keys_merchant ON public.gateway_merchant_api_keys(merchant_id);

-- Trigger for updated_at
CREATE TRIGGER update_gateway_merchant_api_keys_updated_at
  BEFORE UPDATE ON public.gateway_merchant_api_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
