
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS occupation TEXT,
  ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'savings',
  ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES public.institutions(id);

-- Add phone-auth-pin-login and phone-auth-check-pin to config
-- (handled in config.toml separately)
