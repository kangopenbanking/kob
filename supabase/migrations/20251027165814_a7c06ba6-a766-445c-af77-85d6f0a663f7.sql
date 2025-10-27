-- Fix search_path for cleanup_expired_auth_records function
CREATE OR REPLACE FUNCTION public.cleanup_expired_auth_records()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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