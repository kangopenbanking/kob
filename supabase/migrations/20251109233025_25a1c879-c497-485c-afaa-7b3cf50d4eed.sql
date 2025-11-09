-- Create table for storing API health metrics history
CREATE TABLE IF NOT EXISTS public.api_health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL CHECK (status IN ('operational', 'degraded', 'down')),
  response_time INTEGER NOT NULL,
  uptime DECIMAL(5,2) NOT NULL,
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries by date
CREATE INDEX IF NOT EXISTS idx_api_health_metrics_checked_at 
ON public.api_health_metrics(checked_at DESC);

-- Enable RLS
ALTER TABLE public.api_health_metrics ENABLE ROW LEVEL SECURITY;

-- Allow admins to read all metrics
CREATE POLICY "Admins can read all health metrics"
ON public.api_health_metrics
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Allow service role to insert metrics
CREATE POLICY "Service role can insert health metrics"
ON public.api_health_metrics
FOR INSERT
WITH CHECK (true);