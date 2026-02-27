
-- Add linked account columns to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS linked_account_type TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS linked_account_number TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS linked_account_name TEXT DEFAULT NULL;

-- Create customer_linked_accounts table
CREATE TABLE IF NOT EXISTS public.customer_linked_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL,
  account_number TEXT,
  account_name TEXT,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.customer_linked_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own linked accounts"
  ON public.customer_linked_accounts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own linked accounts"
  ON public.customer_linked_accounts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own linked accounts"
  ON public.customer_linked_accounts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());
