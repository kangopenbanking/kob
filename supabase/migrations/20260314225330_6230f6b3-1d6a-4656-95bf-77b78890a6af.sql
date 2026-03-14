-- Add account_status column to profiles for suspend functionality
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active';

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS suspended_reason text;

CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status);