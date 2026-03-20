-- GAP 4: Tables for bank-api-connector (connector_pull mode)

CREATE TABLE IF NOT EXISTS public.bank_api_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id uuid NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  name text NOT NULL,
  base_url text NOT NULL,
  auth_method text NOT NULL DEFAULT 'api_key',
  auth_config_encrypted jsonb DEFAULT '{}'::jsonb,
  paths jsonb DEFAULT '{}'::jsonb,
  environment text NOT NULL DEFAULT 'sandbox',
  poll_interval_seconds integer NOT NULL DEFAULT 300,
  is_active boolean DEFAULT true,
  last_poll_at timestamptz,
  last_poll_status text,
  watermark_value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.bank_api_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on bank_api_endpoints"
  ON public.bank_api_endpoints FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins can manage bank_api_endpoints"
  ON public.bank_api_endpoints FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.bank_api_pull_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid NOT NULL REFERENCES public.bank_api_endpoints(id) ON DELETE CASCADE,
  bank_id uuid NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  accounts_synced integer DEFAULT 0,
  transactions_synced integer DEFAULT 0,
  balances_synced integer DEFAULT 0,
  errors_json jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.bank_api_pull_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on bank_api_pull_runs"
  ON public.bank_api_pull_runs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins can read bank_api_pull_runs"
  ON public.bank_api_pull_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bank_api_endpoints_bank ON public.bank_api_endpoints(bank_id);
CREATE INDEX IF NOT EXISTS idx_bank_api_pull_runs_endpoint ON public.bank_api_pull_runs(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_bank_api_pull_runs_bank ON public.bank_api_pull_runs(bank_id);

COMMENT ON TABLE public.bank_api_endpoints IS 'Configuration for connector_pull mode: KOB polls external bank REST APIs';
COMMENT ON TABLE public.bank_api_pull_runs IS 'Audit trail for each pull sync execution';
COMMENT ON COLUMN public.bank_api_endpoints.auth_method IS 'api_key | oauth2_client_credentials | basic | bearer_token | mtls';
COMMENT ON COLUMN public.bank_api_endpoints.paths IS 'JSON with endpoint paths: {accounts: "/api/accounts", transactions: "/api/transactions", balances: "/api/balances", health: "/health"}';