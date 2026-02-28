-- Add missing columns to customer_linked_accounts
ALTER TABLE public.customer_linked_accounts 
  ADD COLUMN IF NOT EXISTS provider_name TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS provider_type TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last4 TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;