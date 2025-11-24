-- Phase 1: Security Hardening Schema Changes

-- Add API key expiration and IP whitelisting
ALTER TABLE api_clients 
ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 year'),
ADD COLUMN allowed_ips JSONB DEFAULT '[]'::jsonb,
ADD COLUMN last_rotated_at TIMESTAMP WITH TIME ZONE;

-- Add IP whitelisting to user_roles
ALTER TABLE user_roles
ADD COLUMN allowed_ips JSONB DEFAULT '[]'::jsonb;

-- Create JWT secrets table for rotation
CREATE TABLE jwt_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_version TEXT UNIQUE NOT NULL,
  secret_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '90 days'),
  created_by UUID REFERENCES auth.users(id)
);

-- Enhanced audit logging
ALTER TABLE audit_logs
ADD COLUMN geolocation JSONB,
ADD COLUMN device_fingerprint TEXT,
ADD COLUMN session_id UUID;

-- Enhanced rate limiting with user tracking
ALTER TABLE rate_limits
ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Create API key notification tracking
CREATE TABLE api_key_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_client_id UUID REFERENCES api_clients(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL, -- 'expiring_30d', 'expiring_7d', 'expiring_1d', 'expired'
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  email_sent_to TEXT NOT NULL
);

-- Create developer community resources table
CREATE TABLE developer_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type TEXT NOT NULL, -- 'sdk', 'tutorial', 'video', 'example'
  title TEXT NOT NULL,
  description TEXT,
  language TEXT, -- 'javascript', 'python', 'php', etc.
  url TEXT NOT NULL,
  github_url TEXT,
  npm_package TEXT,
  downloads_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create SEO metadata table for dynamic pages
CREATE TABLE seo_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_path TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  keywords TEXT,
  og_image TEXT,
  structured_data JSONB,
  hreflang_tags JSONB DEFAULT '[]'::jsonb,
  canonical_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE jwt_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE developer_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_metadata ENABLE ROW LEVEL SECURITY;

-- RLS Policies for jwt_secrets (admin only)
CREATE POLICY "Admins can manage JWT secrets"
ON jwt_secrets
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for api_key_notifications (view own notifications)
CREATE POLICY "Users can view their API key notifications"
ON api_key_notifications
FOR SELECT
TO authenticated
USING (
  email_sent_to = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- RLS Policies for developer_resources (public read, admin write)
CREATE POLICY "Anyone can view active developer resources"
ON developer_resources
FOR SELECT
TO public
USING (is_active = true);

CREATE POLICY "Admins can manage developer resources"
ON developer_resources
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for seo_metadata (public read, admin write)
CREATE POLICY "Anyone can view active SEO metadata"
ON seo_metadata
FOR SELECT
TO public
USING (is_active = true);

CREATE POLICY "Admins can manage SEO metadata"
ON seo_metadata
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Function to check API key expiration
CREATE OR REPLACE FUNCTION check_api_key_expiration()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expiring_key RECORD;
BEGIN
  -- Find keys expiring in 30, 7, or 1 day(s)
  FOR expiring_key IN
    SELECT 
      ac.id,
      ac.client_id,
      ac.expires_at,
      p.email,
      CASE
        WHEN ac.expires_at <= NOW() + INTERVAL '1 day' THEN 'expiring_1d'
        WHEN ac.expires_at <= NOW() + INTERVAL '7 days' THEN 'expiring_7d'
        WHEN ac.expires_at <= NOW() + INTERVAL '30 days' THEN 'expiring_30d'
      END as notification_type
    FROM api_clients ac
    LEFT JOIN profiles p ON p.id = (
      SELECT user_id FROM institutions WHERE id = ac.institution_id LIMIT 1
    )
    WHERE ac.is_active = true
      AND ac.expires_at IS NOT NULL
      AND ac.expires_at <= NOW() + INTERVAL '30 days'
      AND NOT EXISTS (
        SELECT 1 FROM api_key_notifications
        WHERE api_client_id = ac.id
          AND notification_type = CASE
            WHEN ac.expires_at <= NOW() + INTERVAL '1 day' THEN 'expiring_1d'
            WHEN ac.expires_at <= NOW() + INTERVAL '7 days' THEN 'expiring_7d'
            WHEN ac.expires_at <= NOW() + INTERVAL '30 days' THEN 'expiring_30d'
          END
          AND sent_at > NOW() - INTERVAL '1 day'
      )
  LOOP
    -- Insert notification record
    INSERT INTO api_key_notifications (
      api_client_id,
      notification_type,
      email_sent_to
    ) VALUES (
      expiring_key.id,
      expiring_key.notification_type,
      expiring_key.email
    );
    
    -- Trigger email notification (handled by external edge function)
    PERFORM pg_notify(
      'api_key_expiration',
      json_build_object(
        'client_id', expiring_key.client_id,
        'expires_at', expiring_key.expires_at,
        'email', expiring_key.email,
        'notification_type', expiring_key.notification_type
      )::text
    );
  END LOOP;
END;
$$;

-- Function to validate IP whitelist
CREATE OR REPLACE FUNCTION validate_ip_whitelist(
  _user_id UUID,
  _client_ip INET
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed_ips JSONB;
  ip_entry TEXT;
BEGIN
  -- Get user's allowed IPs from user_roles
  SELECT ur.allowed_ips INTO allowed_ips
  FROM user_roles ur
  WHERE ur.user_id = _user_id
  LIMIT 1;
  
  -- If no IP restrictions, allow
  IF allowed_ips IS NULL OR jsonb_array_length(allowed_ips) = 0 THEN
    RETURN true;
  END IF;
  
  -- Check if client IP matches any allowed IP
  FOR ip_entry IN SELECT jsonb_array_elements_text(allowed_ips)
  LOOP
    IF _client_ip <<= ip_entry::INET THEN
      RETURN true;
    END IF;
  END LOOP;
  
  RETURN false;
END;
$$;

-- Indexes for performance
CREATE INDEX idx_api_clients_expires_at ON api_clients(expires_at) WHERE is_active = true;
CREATE INDEX idx_jwt_secrets_active ON jwt_secrets(is_active, expires_at);
CREATE INDEX idx_rate_limits_user_id ON rate_limits(user_id, window_start);
CREATE INDEX idx_audit_logs_session_id ON audit_logs(session_id);
CREATE INDEX idx_seo_metadata_page_path ON seo_metadata(page_path) WHERE is_active = true;