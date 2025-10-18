-- Phase 8: Production Readiness, Monitoring & Compliance Schema

-- Table for system health checks and monitoring
CREATE TABLE IF NOT EXISTS public.system_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  status TEXT NOT NULL, -- 'healthy', 'degraded', 'down'
  response_time_ms INTEGER,
  error_message TEXT,
  metadata JSONB,
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  limit_exceeded BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, endpoint, window_start)
);

-- Table for compliance reports
CREATE TABLE IF NOT EXISTS public.compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL, -- 'monthly', 'quarterly', 'annual', 'adhoc'
  report_period_start DATE NOT NULL,
  report_period_end DATE NOT NULL,
  total_consents INTEGER DEFAULT 0,
  active_consents INTEGER DEFAULT 0,
  revoked_consents INTEGER DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,
  total_payments INTEGER DEFAULT 0,
  total_api_calls INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  unique_tpps INTEGER DEFAULT 0,
  report_data JSONB,
  generated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for incident logs
CREATE TABLE IF NOT EXISTS public.incident_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
  incident_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  affected_services TEXT[],
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'investigating', 'resolved', 'closed'
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  reported_by UUID REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for system alerts
CREATE TABLE IF NOT EXISTS public.system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL, -- 'performance', 'security', 'error', 'compliance'
  severity TEXT NOT NULL, -- 'info', 'warning', 'error', 'critical'
  message TEXT NOT NULL,
  details JSONB,
  is_acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.system_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for system_health_checks
CREATE POLICY "Admins can view health checks"
  ON public.system_health_checks FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert health checks"
  ON public.system_health_checks FOR INSERT
  WITH CHECK (true);

-- RLS Policies for rate_limits
CREATE POLICY "No direct user access to rate limits"
  ON public.rate_limits FOR ALL
  USING (false);

-- RLS Policies for compliance_reports
CREATE POLICY "Admins can view compliance reports"
  ON public.compliance_reports FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create compliance reports"
  ON public.compliance_reports FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for incident_logs
CREATE POLICY "Admins can manage incident logs"
  ON public.incident_logs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for system_alerts
CREATE POLICY "Admins can view system alerts"
  ON public.system_alerts FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can create alerts"
  ON public.system_alerts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update alerts"
  ON public.system_alerts FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Indexes for performance
CREATE INDEX idx_health_checks_service ON public.system_health_checks(service_name, checked_at DESC);
CREATE INDEX idx_health_checks_status ON public.system_health_checks(status, checked_at DESC);
CREATE INDEX idx_rate_limits_client ON public.rate_limits(client_id, window_start DESC);
CREATE INDEX idx_compliance_reports_period ON public.compliance_reports(report_period_start, report_period_end);
CREATE INDEX idx_incident_logs_status ON public.incident_logs(status, severity);
CREATE INDEX idx_system_alerts_severity ON public.system_alerts(severity, is_acknowledged, created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_incident_logs_updated_at
  BEFORE UPDATE ON public.incident_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _client_id TEXT,
  _endpoint TEXT,
  _limit INTEGER,
  _window_minutes INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_window_end TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  v_window_start := NOW() - (_window_minutes || ' minutes')::INTERVAL;
  v_window_end := NOW();
  
  -- Get current count in window
  SELECT COALESCE(SUM(request_count), 0) INTO v_count
  FROM public.rate_limits
  WHERE client_id = _client_id
    AND endpoint = _endpoint
    AND window_start >= v_window_start;
  
  -- Insert or update current window
  INSERT INTO public.rate_limits (client_id, endpoint, request_count, window_start, window_end, limit_exceeded)
  VALUES (_client_id, _endpoint, 1, v_window_start, v_window_end, v_count >= _limit)
  ON CONFLICT (client_id, endpoint, window_start)
  DO UPDATE SET 
    request_count = rate_limits.request_count + 1,
    limit_exceeded = (rate_limits.request_count + 1) >= _limit;
  
  RETURN v_count < _limit;
END;
$$;

-- Function to generate compliance report
CREATE OR REPLACE FUNCTION public.generate_compliance_report(
  _start_date DATE,
  _end_date DATE,
  _report_type TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report_id UUID;
  v_total_consents INTEGER;
  v_active_consents INTEGER;
  v_revoked_consents INTEGER;
  v_total_transactions INTEGER;
  v_total_payments INTEGER;
  v_total_api_calls INTEGER;
  v_unique_users INTEGER;
  v_unique_tpps INTEGER;
BEGIN
  -- Calculate metrics
  SELECT COUNT(*) INTO v_total_consents
  FROM public.aisp_consents
  WHERE created_at::DATE BETWEEN _start_date AND _end_date;
  
  SELECT COUNT(*) INTO v_active_consents
  FROM public.aisp_consents
  WHERE status = 'Authorised'
    AND created_at::DATE BETWEEN _start_date AND _end_date;
  
  SELECT COUNT(*) INTO v_revoked_consents
  FROM public.aisp_consents
  WHERE status = 'Revoked'
    AND revoked_at::DATE BETWEEN _start_date AND _end_date;
  
  SELECT COUNT(*) INTO v_total_transactions
  FROM public.transactions
  WHERE created_at::DATE BETWEEN _start_date AND _end_date;
  
  SELECT COUNT(*) INTO v_total_payments
  FROM public.payments
  WHERE created_at::DATE BETWEEN _start_date AND _end_date;
  
  SELECT COUNT(*) INTO v_total_api_calls
  FROM public.api_usage_metrics
  WHERE created_at::DATE BETWEEN _start_date AND _end_date;
  
  SELECT COUNT(DISTINCT user_id) INTO v_unique_users
  FROM public.aisp_consents
  WHERE created_at::DATE BETWEEN _start_date AND _end_date;
  
  SELECT COUNT(DISTINCT client_id) INTO v_unique_tpps
  FROM public.aisp_consents
  WHERE created_at::DATE BETWEEN _start_date AND _end_date;
  
  -- Create report
  INSERT INTO public.compliance_reports (
    report_type,
    report_period_start,
    report_period_end,
    total_consents,
    active_consents,
    revoked_consents,
    total_transactions,
    total_payments,
    total_api_calls,
    unique_users,
    unique_tpps,
    generated_by
  ) VALUES (
    _report_type,
    _start_date,
    _end_date,
    v_total_consents,
    v_active_consents,
    v_revoked_consents,
    v_total_transactions,
    v_total_payments,
    v_total_api_calls,
    v_unique_users,
    v_unique_tpps,
    auth.uid()
  ) RETURNING id INTO v_report_id;
  
  RETURN v_report_id;
END;
$$;