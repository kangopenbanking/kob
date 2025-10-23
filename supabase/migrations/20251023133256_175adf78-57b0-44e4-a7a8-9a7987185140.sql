-- Extend profiles table for phone authentication
ALTER TABLE public.profiles
  -- Make email nullable for phone-only users
  ALTER COLUMN email DROP NOT NULL,
  
  -- Add phone number fields
  ADD COLUMN IF NOT EXISTS phone_number TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT '+237',
  
  -- Add PIN code fields (for password recovery)
  ADD COLUMN IF NOT EXISTS pin_code_hash TEXT,
  ADD COLUMN IF NOT EXISTS pin_code_set_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS pin_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_locked_until TIMESTAMP WITH TIME ZONE,
  
  -- Migration tracking
  ADD COLUMN IF NOT EXISTS migration_required BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS migration_grace_period_ends TIMESTAMP WITH TIME ZONE,
  
  -- Preferred OTP method
  ADD COLUMN IF NOT EXISTS preferred_otp_method TEXT DEFAULT 'sms' CHECK (preferred_otp_method IN ('sms', 'whatsapp', 'both'));

-- Create index for phone lookups
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON public.profiles(phone_number) WHERE phone_number IS NOT NULL;

-- Mark existing users for migration (30-day grace period)
UPDATE public.profiles 
SET 
  migration_required = TRUE,
  migration_grace_period_ends = NOW() + INTERVAL '30 days'
WHERE phone_number IS NULL AND email IS NOT NULL;

-- Create phone_otp_codes table
CREATE TABLE IF NOT EXISTS public.phone_otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  otp_type TEXT NOT NULL CHECK (otp_type IN ('login', 'signup', 'verification', 'pin_reset', 'password_reset')),
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('sms', 'whatsapp', 'both')),
  
  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'expired', 'failed')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  
  -- Delivery tracking
  sms_sent BOOLEAN DEFAULT FALSE,
  sms_sent_at TIMESTAMP WITH TIME ZONE,
  whatsapp_sent BOOLEAN DEFAULT FALSE,
  whatsapp_sent_at TIMESTAMP WITH TIME ZONE,
  
  -- Expiration
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  
  -- Security
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_otp_phone ON public.phone_otp_codes(phone_number);
CREATE INDEX IF NOT EXISTS idx_phone_otp_expires ON public.phone_otp_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_phone_otp_status ON public.phone_otp_codes(status);

-- Create captcha_challenges table
CREATE TABLE IF NOT EXISTS public.captcha_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  
  -- Challenge details
  challenge_question TEXT NOT NULL,
  challenge_answer INTEGER NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'expired', 'failed')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  
  -- Expiration
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  
  -- Security
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_captcha_session ON public.captcha_challenges(session_id);
CREATE INDEX IF NOT EXISTS idx_captcha_expires ON public.captcha_challenges(expires_at);

-- Enable RLS on new tables
ALTER TABLE public.phone_otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captcha_challenges ENABLE ROW LEVEL SECURITY;

-- RLS Policies for phone_otp_codes
DROP POLICY IF EXISTS "Users can view their own OTP records" ON public.phone_otp_codes;
CREATE POLICY "Users can view their own OTP records"
  ON public.phone_otp_codes FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage OTP records" ON public.phone_otp_codes;
CREATE POLICY "Service role can manage OTP records"
  ON public.phone_otp_codes FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for captcha_challenges
DROP POLICY IF EXISTS "Anyone can create captcha challenges" ON public.captcha_challenges;
CREATE POLICY "Anyone can create captcha challenges"
  ON public.captcha_challenges FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their session captchas" ON public.captcha_challenges;
CREATE POLICY "Users can view their session captchas"
  ON public.captcha_challenges FOR SELECT
  USING (true);

-- Function to clean up expired records (to be called by cron)
CREATE OR REPLACE FUNCTION cleanup_expired_auth_records()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete expired OTP codes older than 1 hour
  DELETE FROM public.phone_otp_codes
  WHERE expires_at < NOW() - INTERVAL '1 hour';
  
  -- Delete expired captcha challenges older than 1 hour
  DELETE FROM public.captcha_challenges
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$;