-- PostiQ Address Verifications Table
CREATE TABLE public.postiq_address_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  postiq_code VARCHAR(10) NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  precision VARCHAR(20) NOT NULL,
  region VARCHAR(100),
  district VARCHAR(100),
  sector VARCHAR(100),
  area_name VARCHAR(100),
  road_name VARCHAR(200),
  house_number VARCHAR(20),
  full_address TEXT,
  verification_method VARCHAR(50),
  credits_consumed INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PostiQ API Keys Table (for institutional use)
CREATE TABLE public.postiq_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES public.institutions(id),
  api_key TEXT NOT NULL,
  api_secret TEXT NOT NULL,
  is_sandbox BOOLEAN DEFAULT false,
  credits_remaining INTEGER DEFAULT 0,
  rate_limit_per_hour INTEGER DEFAULT 1000,
  rate_limit_per_day INTEGER DEFAULT 10000,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- PostiQ API Usage Tracking
CREATE TABLE public.postiq_api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  institution_id UUID REFERENCES public.institutions(id),
  endpoint VARCHAR(100) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER,
  credits_consumed INTEGER DEFAULT 1,
  request_data JSONB,
  response_data JSONB,
  error_message TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX idx_postiq_verifications_user ON public.postiq_address_verifications(user_id);
CREATE INDEX idx_postiq_verifications_code ON public.postiq_address_verifications(postiq_code);
CREATE INDEX idx_postiq_verifications_active ON public.postiq_address_verifications(user_id, is_active, verified_at);
CREATE INDEX idx_postiq_usage_user ON public.postiq_api_usage(user_id);
CREATE INDEX idx_postiq_usage_created ON public.postiq_api_usage(created_at);

-- Enable Row Level Security
ALTER TABLE public.postiq_address_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postiq_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postiq_api_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can view their own verifications
CREATE POLICY "Users can view own verifications"
  ON public.postiq_address_verifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own verifications"
  ON public.postiq_address_verifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies: Only admins can manage API keys
CREATE POLICY "Admins can manage API keys"
  ON public.postiq_api_keys FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies: Users can view their own usage
CREATE POLICY "Users can view own usage"
  ON public.postiq_api_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all usage"
  ON public.postiq_api_usage FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Database Function: Check PostiQ Rate Limit (5 per day per user)
CREATE OR REPLACE FUNCTION public.check_postiq_rate_limit(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.postiq_address_verifications
  WHERE user_id = p_user_id
    AND verified_at > NOW() - INTERVAL '24 hours';
  
  RETURN v_count < 5;
END;
$$;

-- Database Function: Get User's Most Recent PostiQ Verification
CREATE OR REPLACE FUNCTION public.get_user_postiq_verification(p_user_id UUID)
RETURNS TABLE (
  postiq_code VARCHAR(10),
  full_address TEXT,
  verified_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pav.postiq_code,
    pav.full_address,
    pav.verified_at
  FROM public.postiq_address_verifications pav
  WHERE pav.user_id = p_user_id
    AND pav.is_active = true
  ORDER BY pav.verified_at DESC
  LIMIT 1;
END;
$$;

-- Trigger: Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_postiq_verification_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_postiq_verification_updated_at
  BEFORE UPDATE ON public.postiq_address_verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_postiq_verification_timestamp();