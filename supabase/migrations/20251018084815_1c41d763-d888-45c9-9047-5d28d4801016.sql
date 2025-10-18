-- Phase 10: Security Enhancements Schema

-- Table for security audit logs
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'login', 'logout', 'password_change', 'mfa_enabled', 'consent_granted', etc.
  event_category TEXT NOT NULL, -- 'authentication', 'authorization', 'data_access', 'account_change'
  ip_address INET,
  user_agent TEXT,
  location JSONB, -- {country, city, region}
  device_info JSONB, -- {device_type, os, browser}
  risk_score INTEGER DEFAULT 0, -- 0-100, higher means riskier
  blocked BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for trusted devices
CREATE TABLE IF NOT EXISTS public.trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  device_name TEXT,
  device_type TEXT, -- 'desktop', 'mobile', 'tablet'
  browser TEXT,
  os TEXT,
  ip_address INET,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  is_trusted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_fingerprint)
);

-- Table for MFA settings
CREATE TABLE IF NOT EXISTS public.mfa_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  mfa_enabled BOOLEAN DEFAULT false,
  mfa_method TEXT, -- 'totp', 'sms', 'email'
  backup_codes TEXT[], -- Encrypted backup codes
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for security settings per user
CREATE TABLE IF NOT EXISTS public.user_security_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  require_mfa BOOLEAN DEFAULT false,
  session_timeout_minutes INTEGER DEFAULT 60,
  notify_suspicious_login BOOLEAN DEFAULT true,
  notify_new_device BOOLEAN DEFAULT true,
  notify_consent_changes BOOLEAN DEFAULT true,
  notify_payment_initiated BOOLEAN DEFAULT true,
  ip_whitelist INET[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for suspicious activity detection
CREATE TABLE IF NOT EXISTS public.suspicious_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- 'unusual_location', 'multiple_failed_logins', 'velocity_check', 'device_change'
  severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
  description TEXT NOT NULL,
  risk_indicators JSONB, -- Multiple risk factors
  ip_address INET,
  user_agent TEXT,
  action_taken TEXT, -- 'blocked', 'flagged', 'mfa_required', 'none'
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for failed login attempts
CREATE TABLE IF NOT EXISTS public.failed_login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address INET NOT NULL,
  user_agent TEXT,
  failure_reason TEXT,
  attempt_count INTEGER DEFAULT 1,
  last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suspicious_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.failed_login_attempts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for security_audit_logs
CREATE POLICY "Users can view own audit logs"
  ON public.security_audit_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all audit logs"
  ON public.security_audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert audit logs"
  ON public.security_audit_logs FOR INSERT
  WITH CHECK (true);

-- RLS Policies for trusted_devices
CREATE POLICY "Users can view own devices"
  ON public.trusted_devices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own devices"
  ON public.trusted_devices FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all devices"
  ON public.trusted_devices FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for mfa_settings
CREATE POLICY "Users can view own MFA settings"
  ON public.mfa_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own MFA settings"
  ON public.mfa_settings FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for user_security_settings
CREATE POLICY "Users can view own security settings"
  ON public.user_security_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own security settings"
  ON public.user_security_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own security settings"
  ON public.user_security_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for suspicious_activities
CREATE POLICY "Users can view own suspicious activities"
  ON public.suspicious_activities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage suspicious activities"
  ON public.suspicious_activities FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert suspicious activities"
  ON public.suspicious_activities FOR INSERT
  WITH CHECK (true);

-- RLS Policies for failed_login_attempts
CREATE POLICY "No direct user access to failed login attempts"
  ON public.failed_login_attempts FOR ALL
  USING (false);

-- Indexes for performance
CREATE INDEX idx_audit_logs_user ON public.security_audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_event_type ON public.security_audit_logs(event_type, created_at DESC);
CREATE INDEX idx_audit_logs_risk_score ON public.security_audit_logs(risk_score DESC, created_at DESC);
CREATE INDEX idx_trusted_devices_user ON public.trusted_devices(user_id, last_used_at DESC);
CREATE INDEX idx_trusted_devices_fingerprint ON public.trusted_devices(device_fingerprint);
CREATE INDEX idx_suspicious_activities_user ON public.suspicious_activities(user_id, severity, created_at DESC);
CREATE INDEX idx_suspicious_activities_resolved ON public.suspicious_activities(resolved, severity, created_at DESC);
CREATE INDEX idx_failed_logins_email ON public.failed_login_attempts(email, last_attempt_at DESC);
CREATE INDEX idx_failed_logins_ip ON public.failed_login_attempts(ip_address, last_attempt_at DESC);

-- Triggers for updated_at
CREATE TRIGGER update_mfa_settings_updated_at
  BEFORE UPDATE ON public.mfa_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_security_settings_updated_at
  BEFORE UPDATE ON public.user_security_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to log security event
CREATE OR REPLACE FUNCTION public.log_security_event(
  _user_id UUID,
  _event_type TEXT,
  _event_category TEXT,
  _ip_address INET DEFAULT NULL,
  _user_agent TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
  v_risk_score INTEGER := 0;
BEGIN
  -- Calculate basic risk score
  IF _event_type IN ('failed_login', 'password_reset_request', 'suspicious_transaction') THEN
    v_risk_score := 30;
  END IF;
  
  -- Insert audit log
  INSERT INTO public.security_audit_logs (
    user_id,
    event_type,
    event_category,
    ip_address,
    user_agent,
    risk_score,
    metadata
  ) VALUES (
    _user_id,
    _event_type,
    _event_category,
    _ip_address,
    _user_agent,
    v_risk_score,
    _metadata
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Function to check for suspicious login
CREATE OR REPLACE FUNCTION public.check_suspicious_login(
  _user_id UUID,
  _ip_address INET,
  _user_agent TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_logins INTEGER;
  v_different_ips INTEGER;
  v_risk_score INTEGER := 0;
  v_flags TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Check for multiple rapid logins (velocity check)
  SELECT COUNT(*) INTO v_recent_logins
  FROM public.security_audit_logs
  WHERE user_id = _user_id
    AND event_type = 'login'
    AND created_at > NOW() - INTERVAL '1 hour';
  
  IF v_recent_logins > 10 THEN
    v_risk_score := v_risk_score + 40;
    v_flags := array_append(v_flags, 'high_velocity');
  END IF;
  
  -- Check for different IPs in short time
  SELECT COUNT(DISTINCT ip_address) INTO v_different_ips
  FROM public.security_audit_logs
  WHERE user_id = _user_id
    AND created_at > NOW() - INTERVAL '1 hour';
  
  IF v_different_ips > 3 THEN
    v_risk_score := v_risk_score + 30;
    v_flags := array_append(v_flags, 'multiple_locations');
  END IF;
  
  -- Check if device is trusted
  IF NOT EXISTS (
    SELECT 1 FROM public.trusted_devices
    WHERE user_id = _user_id AND is_trusted = true
  ) THEN
    v_risk_score := v_risk_score + 20;
    v_flags := array_append(v_flags, 'untrusted_device');
  END IF;
  
  -- Log if suspicious
  IF v_risk_score > 50 THEN
    INSERT INTO public.suspicious_activities (
      user_id,
      activity_type,
      severity,
      description,
      risk_indicators,
      ip_address,
      user_agent,
      action_taken
    ) VALUES (
      _user_id,
      'suspicious_login',
      CASE 
        WHEN v_risk_score > 80 THEN 'critical'
        WHEN v_risk_score > 60 THEN 'high'
        ELSE 'medium'
      END,
      'Suspicious login pattern detected',
      jsonb_build_object('flags', v_flags, 'risk_score', v_risk_score),
      _ip_address,
      _user_agent,
      CASE WHEN v_risk_score > 80 THEN 'mfa_required' ELSE 'flagged' END
    );
  END IF;
  
  RETURN jsonb_build_object(
    'risk_score', v_risk_score,
    'flags', v_flags,
    'action', CASE 
      WHEN v_risk_score > 80 THEN 'require_mfa'
      WHEN v_risk_score > 50 THEN 'notify_user'
      ELSE 'allow'
    END
  );
END;
$$;