-- Create sandbox webhooks table
CREATE TABLE IF NOT EXISTS public.sandbox_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sandbox_account_id UUID NOT NULL REFERENCES public.developer_sandbox_accounts(id) ON DELETE CASCADE,
  webhook_url TEXT NOT NULL,
  event_types TEXT[] NOT NULL DEFAULT ARRAY['rate_limit_warning', 'rate_limit_exceeded'],
  is_active BOOLEAN DEFAULT true,
  secret_key TEXT,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sandbox_webhooks ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own webhooks"
  ON public.sandbox_webhooks FOR SELECT
  USING (
    sandbox_account_id IN (
      SELECT id FROM public.developer_sandbox_accounts 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own webhooks"
  ON public.sandbox_webhooks FOR INSERT
  WITH CHECK (
    sandbox_account_id IN (
      SELECT id FROM public.developer_sandbox_accounts 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own webhooks"
  ON public.sandbox_webhooks FOR UPDATE
  USING (
    sandbox_account_id IN (
      SELECT id FROM public.developer_sandbox_accounts 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own webhooks"
  ON public.sandbox_webhooks FOR DELETE
  USING (
    sandbox_account_id IN (
      SELECT id FROM public.developer_sandbox_accounts 
      WHERE user_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX idx_sandbox_webhooks_account ON public.sandbox_webhooks(sandbox_account_id);
CREATE INDEX idx_sandbox_webhooks_active ON public.sandbox_webhooks(is_active) WHERE is_active = true;

-- Create webhook delivery logs table
CREATE TABLE IF NOT EXISTS public.sandbox_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES public.sandbox_webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  delivered_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for logs
ALTER TABLE public.sandbox_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their webhook logs"
  ON public.sandbox_webhook_logs FOR SELECT
  USING (
    webhook_id IN (
      SELECT w.id FROM public.sandbox_webhooks w
      JOIN public.developer_sandbox_accounts a ON w.sandbox_account_id = a.id
      WHERE a.user_id = auth.uid()
    )
  );

-- Create index
CREATE INDEX idx_webhook_logs_webhook ON public.sandbox_webhook_logs(webhook_id);
CREATE INDEX idx_webhook_logs_created ON public.sandbox_webhook_logs(created_at DESC);