-- Create developer sandbox tables
CREATE TABLE IF NOT EXISTS public.developer_sandbox_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  website TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'revoked')),
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'basic', 'pro')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sandbox_api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sandbox_account_id UUID NOT NULL REFERENCES public.developer_sandbox_accounts(id) ON DELETE CASCADE,
  key_name TEXT NOT NULL,
  api_key TEXT NOT NULL UNIQUE,
  key_hash TEXT NOT NULL,
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
  rate_limit_per_day INTEGER NOT NULL DEFAULT 1000,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.sandbox_api_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID NOT NULL REFERENCES public.sandbox_api_keys(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  request_size INTEGER,
  response_size INTEGER,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sandbox_rate_limit_tracker (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID NOT NULL REFERENCES public.sandbox_api_keys(id) ON DELETE CASCADE,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  window_end TIMESTAMP WITH TIME ZONE NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  limit_exceeded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.developer_sandbox_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sandbox_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sandbox_api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sandbox_rate_limit_tracker ENABLE ROW LEVEL SECURITY;

-- RLS Policies for developer_sandbox_accounts
CREATE POLICY "Users can view their own sandbox accounts"
  ON public.developer_sandbox_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sandbox accounts"
  ON public.developer_sandbox_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sandbox accounts"
  ON public.developer_sandbox_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all sandbox accounts"
  ON public.developer_sandbox_accounts FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all sandbox accounts"
  ON public.developer_sandbox_accounts FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for sandbox_api_keys
CREATE POLICY "Users can view their own API keys"
  ON public.sandbox_api_keys FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.developer_sandbox_accounts
      WHERE id = sandbox_api_keys.sandbox_account_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create API keys for their accounts"
  ON public.sandbox_api_keys FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.developer_sandbox_accounts
      WHERE id = sandbox_api_keys.sandbox_account_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own API keys"
  ON public.sandbox_api_keys FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.developer_sandbox_accounts
      WHERE id = sandbox_api_keys.sandbox_account_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own API keys"
  ON public.sandbox_api_keys FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.developer_sandbox_accounts
      WHERE id = sandbox_api_keys.sandbox_account_id
      AND user_id = auth.uid()
    )
  );

-- RLS Policies for sandbox_api_usage
CREATE POLICY "Users can view their own API usage"
  ON public.sandbox_api_usage FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sandbox_api_keys sk
      JOIN public.developer_sandbox_accounts sa ON sk.sandbox_account_id = sa.id
      WHERE sk.id = sandbox_api_usage.api_key_id
      AND sa.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all API usage"
  ON public.sandbox_api_usage FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for sandbox_rate_limit_tracker
CREATE POLICY "Users can view their own rate limits"
  ON public.sandbox_rate_limit_tracker FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sandbox_api_keys sk
      JOIN public.developer_sandbox_accounts sa ON sk.sandbox_account_id = sa.id
      WHERE sk.id = sandbox_rate_limit_tracker.api_key_id
      AND sa.user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX idx_sandbox_api_keys_account ON public.sandbox_api_keys(sandbox_account_id);
CREATE INDEX idx_sandbox_api_keys_active ON public.sandbox_api_keys(is_active) WHERE is_active = true;
CREATE INDEX idx_sandbox_api_usage_key ON public.sandbox_api_usage(api_key_id);
CREATE INDEX idx_sandbox_api_usage_created ON public.sandbox_api_usage(created_at DESC);
CREATE INDEX idx_sandbox_rate_limit_key ON public.sandbox_rate_limit_tracker(api_key_id);
CREATE INDEX idx_sandbox_rate_limit_window ON public.sandbox_rate_limit_tracker(window_start, window_end);

-- Trigger for updated_at
CREATE TRIGGER update_developer_sandbox_accounts_updated_at
  BEFORE UPDATE ON public.developer_sandbox_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();