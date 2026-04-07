ALTER TABLE public.user_preferences 
  ADD COLUMN IF NOT EXISTS biometric_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false;