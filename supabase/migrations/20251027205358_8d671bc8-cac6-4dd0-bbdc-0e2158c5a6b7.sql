-- Create system_config table for system configuration management
CREATE TABLE IF NOT EXISTS public.system_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  is_sensitive BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on system_config
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Only admins can view system config
CREATE POLICY "Admins can view system config"
ON public.system_config
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Only admins can update system config
CREATE POLICY "Admins can update system config"
ON public.system_config
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Only admins can insert system config
CREATE POLICY "Admins can insert system config"
ON public.system_config
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Add missing columns to webhooks table
ALTER TABLE public.webhooks ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE public.webhooks ADD COLUMN IF NOT EXISTS description TEXT;

-- Update existing webhooks to use url column if webhook_url exists
UPDATE public.webhooks SET url = webhook_url WHERE url IS NULL AND webhook_url IS NOT NULL;

-- Add missing user_id column to transactions table
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_system_config_category ON public.system_config(category);
CREATE INDEX IF NOT EXISTS idx_system_config_key ON public.system_config(key);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_client_id ON public.webhooks(client_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_is_active ON public.webhooks(is_active);

-- Insert default system configurations
INSERT INTO public.system_config (key, value, category, description, is_sensitive) VALUES
('rate_limit.default', '{"requests_per_minute": 60, "burst_size": 100}', 'security', 'Default API rate limiting configuration', false),
('oauth.token_lifetime', '{"access_token_minutes": 60, "refresh_token_days": 30}', 'oauth', 'OAuth token lifetime settings', false),
('kyc.required_documents', '["identity", "proof_of_address"]', 'compliance', 'Required KYC documents', false),
('fee.default_model', '"percentage"', 'billing', 'Default fee calculation model', false),
('webhook.retry_attempts', '5', 'webhooks', 'Maximum webhook delivery retry attempts', false),
('webhook.timeout_seconds', '30', 'webhooks', 'Webhook request timeout in seconds', false),
('api.max_page_size', '100', 'api', 'Maximum number of records per API page', false),
('security.mfa_required', 'false', 'security', 'Require MFA for all users', false),
('security.password_min_length', '8', 'security', 'Minimum password length', false),
('transaction.daily_limit', '{"amount": 1000000, "currency": "XAF"}', 'limits', 'Daily transaction limit per user', false)
ON CONFLICT (key) DO NOTHING;

-- Create updated_at trigger for system_config
CREATE TRIGGER update_system_config_updated_at
BEFORE UPDATE ON public.system_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();