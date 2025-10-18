-- Phase 6: Webhooks & Analytics System

-- Create webhooks table for TPP event subscriptions
CREATE TABLE public.webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  events TEXT[] NOT NULL, -- Array of event types to subscribe to
  secret TEXT NOT NULL, -- For HMAC signature validation
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  failure_count INTEGER DEFAULT 0,
  last_failure_at TIMESTAMP WITH TIME ZONE,
  last_failure_reason TEXT
);

-- Create webhook_deliveries table to track delivery attempts
CREATE TABLE public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  status TEXT NOT NULL, -- pending, delivered, failed
  http_status INTEGER,
  response_body TEXT,
  attempt_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  delivered_at TIMESTAMP WITH TIME ZONE
);

-- Create api_usage_metrics table for analytics
CREATE TABLE public.api_usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for webhooks
CREATE POLICY "Admins can manage all webhooks"
  ON public.webhooks FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Institutions can manage own webhooks"
  ON public.webhooks FOR ALL
  USING (institution_id IN (
    SELECT id FROM public.institutions WHERE user_id = auth.uid()
  ));

CREATE POLICY "Institutions can view own webhooks"
  ON public.webhooks FOR SELECT
  USING (institution_id IN (
    SELECT id FROM public.institutions WHERE user_id = auth.uid()
  ));

-- RLS Policies for webhook_deliveries
CREATE POLICY "Admins can view all webhook deliveries"
  ON public.webhook_deliveries FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Institutions can view own webhook deliveries"
  ON public.webhook_deliveries FOR SELECT
  USING (webhook_id IN (
    SELECT id FROM public.webhooks WHERE institution_id IN (
      SELECT id FROM public.institutions WHERE user_id = auth.uid()
    )
  ));

-- RLS Policies for api_usage_metrics
CREATE POLICY "Admins can view all metrics"
  ON public.api_usage_metrics FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Institutions can view own metrics"
  ON public.api_usage_metrics FOR SELECT
  USING (institution_id IN (
    SELECT id FROM public.institutions WHERE user_id = auth.uid()
  ));

-- Create indexes
CREATE INDEX idx_webhooks_institution_id ON public.webhooks(institution_id);
CREATE INDEX idx_webhooks_client_id ON public.webhooks(client_id);
CREATE INDEX idx_webhooks_is_active ON public.webhooks(is_active);
CREATE INDEX idx_webhook_deliveries_webhook_id ON public.webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_status ON public.webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_created_at ON public.webhook_deliveries(created_at);
CREATE INDEX idx_api_metrics_institution_id ON public.api_usage_metrics(institution_id);
CREATE INDEX idx_api_metrics_client_id ON public.api_usage_metrics(client_id);
CREATE INDEX idx_api_metrics_created_at ON public.api_usage_metrics(created_at);
CREATE INDEX idx_api_metrics_endpoint ON public.api_usage_metrics(endpoint);

-- Trigger for webhooks updated_at
CREATE TRIGGER update_webhooks_updated_at
  BEFORE UPDATE ON public.webhooks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to trigger webhook delivery
CREATE OR REPLACE FUNCTION public.trigger_webhooks(_event_type TEXT, _event_data JSONB, _client_id TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  webhook_record RECORD;
BEGIN
  -- Find all active webhooks subscribed to this event
  FOR webhook_record IN
    SELECT * FROM public.webhooks
    WHERE is_active = true
      AND _event_type = ANY(events)
      AND (_client_id IS NULL OR client_id = _client_id)
  LOOP
    -- Insert webhook delivery record
    INSERT INTO public.webhook_deliveries (
      webhook_id,
      event_type,
      event_data,
      status
    ) VALUES (
      webhook_record.id,
      _event_type,
      _event_data,
      'pending'
    );
  END LOOP;
END;
$$;