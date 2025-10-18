-- OAuth2 Token Management Tables
CREATE TABLE IF NOT EXISTS public.refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  scope text NOT NULL,
  expires_at timestamptz NOT NULL,
  is_revoked boolean DEFAULT false,
  revoked_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct user access to refresh tokens" ON public.refresh_tokens;
CREATE POLICY "No direct user access to refresh tokens"
ON public.refresh_tokens
FOR ALL
USING (false)
WITH CHECK (false);

-- API Clients Table for OAuth2
CREATE TABLE IF NOT EXISTS public.api_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL UNIQUE,
  client_secret_hash text NOT NULL,
  client_name text NOT NULL,
  redirect_uris jsonb NOT NULL DEFAULT '[]'::jsonb,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  grant_types jsonb NOT NULL DEFAULT '["authorization_code"]'::jsonb,
  institution_id uuid REFERENCES public.institutions(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.api_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage all API clients" ON public.api_clients;
CREATE POLICY "Admins can manage all API clients"
ON public.api_clients
FOR ALL
USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Institutions can view own API clients" ON public.api_clients;
CREATE POLICY "Institutions can view own API clients"
ON public.api_clients
FOR SELECT
USING (institution_id IN (
  SELECT id FROM public.institutions WHERE user_id = auth.uid()
));

-- Sandbox Accounts Table
CREATE TABLE IF NOT EXISTS public.sandbox_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL UNIQUE,
  account_type account_type DEFAULT 'Personal',
  account_subtype account_subtype DEFAULT 'Current',
  currency text DEFAULT 'XAF',
  account_holder_name text NOT NULL,
  identification_value text NOT NULL,
  identification_scheme account_scheme DEFAULT 'LOCAL_BANK',
  balance numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.sandbox_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage sandbox accounts" ON public.sandbox_accounts;
CREATE POLICY "Admins can manage sandbox accounts"
ON public.sandbox_accounts
FOR ALL
USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone can view sandbox accounts" ON public.sandbox_accounts;
CREATE POLICY "Anyone can view sandbox accounts"
ON public.sandbox_accounts
FOR SELECT
USING (true);

-- Language Preferences
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  language text DEFAULT 'en' CHECK (language IN ('en', 'fr')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own preferences" ON public.user_preferences;
CREATE POLICY "Users can manage own preferences"
ON public.user_preferences
FOR ALL
USING (auth.uid() = user_id);

-- Update access_tokens table with more fields
ALTER TABLE public.access_tokens
ADD COLUMN IF NOT EXISTS refresh_token_id uuid REFERENCES public.refresh_tokens(id) ON DELETE CASCADE;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON public.refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_client ON public.refresh_tokens(client_id);
CREATE INDEX IF NOT EXISTS idx_api_clients_client_id ON public.api_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_accounts_account_id ON public.sandbox_accounts(account_id);