
-- CBPII (Confirmation of Funds) Consents table
CREATE TABLE IF NOT EXISTS public.cbpii_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  client_id TEXT NOT NULL DEFAULT 'self',
  debtor_account JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'AwaitingAuthorisation',
  expiration_date TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cbpii_consents ENABLE ROW LEVEL SECURITY;

-- RLS: users can manage their own consents
CREATE POLICY "Users manage own CBPII consents" ON public.cbpii_consents
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin full access
CREATE POLICY "Admins manage all CBPII consents" ON public.cbpii_consents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add payment_type column to payments table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'payment_type'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN payment_type TEXT DEFAULT 'domestic';
  END IF;
END $$;

-- Add metadata column to payments table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN metadata JSONB;
  END IF;
END $$;

-- Add payment_type column to pisp_consents table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'pisp_consents' AND column_name = 'payment_type'
  ) THEN
    ALTER TABLE public.pisp_consents ADD COLUMN payment_type TEXT DEFAULT 'domestic';
  END IF;
END $$;

-- Add metadata column to pisp_consents table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'pisp_consents' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.pisp_consents ADD COLUMN metadata JSONB;
  END IF;
END $$;
