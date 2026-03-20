
-- =====================================================
-- KOB Bank Connector Layer — Full Schema Migration
-- Phase 1-4: Banks, Connectors, Ingestion, PSU Links, Payments
-- =====================================================

-- Phase 1: Bank Directory + Onboarding
CREATE TABLE public.banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  short_code TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL DEFAULT 'CM',
  swift_bic TEXT,
  bank_code TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'active', 'suspended')),
  integration_mode TEXT NOT NULL DEFAULT 'connector_push' CHECK (integration_mode IN ('connector_push', 'connector_pull', 'file_feed', 'hybrid')),
  contact_email TEXT,
  support_phone TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.bank_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city TEXT,
  address TEXT,
  postiq_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.bank_connector_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'prod')),
  base_url TEXT,
  connector_type TEXT NOT NULL DEFAULT 'rest' CHECK (connector_type IN ('rest', 'iso20022', 'file')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'disabled')),
  hmac_secret_hash TEXT,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.bank_connector_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES public.bank_connector_instances(id) ON DELETE CASCADE,
  certificate_pem TEXT NOT NULL,
  thumbprint TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.bank_connector_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.bank_connector_instances(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'unknown',
  latency_ms INTEGER,
  last_check_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  details_json JSONB DEFAULT '{}',
  UNIQUE (instance_id)
);

-- Phase 2: Bank-Sourced Data Tables
CREATE TABLE public.bank_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  external_customer_id TEXT NOT NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bank_id, external_customer_id)
);

CREATE TABLE public.bank_sourced_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.bank_customers(id) ON DELETE SET NULL,
  external_account_id TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'CurrentAccount',
  identification_scheme TEXT DEFAULT 'BBAN',
  identification_value TEXT,
  currency TEXT NOT NULL DEFAULT 'XAF',
  status TEXT NOT NULL DEFAULT 'active',
  nickname TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bank_id, external_account_id)
);

CREATE TABLE public.bank_sourced_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.bank_sourced_accounts(id) ON DELETE CASCADE,
  balance_type TEXT NOT NULL DEFAULT 'ClosingAvailable',
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'XAF',
  as_of_datetime TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.bank_sourced_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.bank_sourced_accounts(id) ON DELETE CASCADE,
  external_tx_id TEXT NOT NULL,
  booking_date DATE NOT NULL,
  value_date DATE,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  credit_debit TEXT NOT NULL DEFAULT 'Debit' CHECK (credit_debit IN ('Credit', 'Debit')),
  reference TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, external_tx_id)
);

CREATE TABLE public.bank_sourced_beneficiaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.bank_sourced_accounts(id) ON DELETE CASCADE,
  beneficiary_name TEXT NOT NULL,
  scheme_name TEXT DEFAULT 'BBAN',
  identification TEXT,
  bank_id_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, beneficiary_name, identification)
);

-- Phase 3: PSU Linking
CREATE TABLE public.bank_psu_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  bank_customer_id UUID REFERENCES public.bank_customers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
  linked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, bank_id)
);

-- Phase 4: Bank Payments
CREATE TABLE public.bank_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  external_payment_id TEXT,
  user_id UUID NOT NULL,
  consent_id TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  debtor_account_ref TEXT,
  creditor_account_ref TEXT,
  creditor_name TEXT,
  remittance_info TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'failed', 'reversed')),
  idempotency_key TEXT,
  connector_instance_id UUID REFERENCES public.bank_connector_instances(id),
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bank_id, idempotency_key)
);

CREATE TABLE public.bank_payment_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.bank_payments(id) ON DELETE CASCADE,
  status_from TEXT,
  status_to TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'engine',
  event_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  details_json JSONB DEFAULT '{}'
);

-- Indexes
CREATE INDEX idx_banks_status ON public.banks(status);
CREATE INDEX idx_banks_country ON public.banks(country);
CREATE INDEX idx_bank_branches_bank_id ON public.bank_branches(bank_id);
CREATE INDEX idx_bank_connector_instances_bank_id ON public.bank_connector_instances(bank_id);
CREATE INDEX idx_bank_connector_certificates_instance_id ON public.bank_connector_certificates(instance_id);
CREATE INDEX idx_bank_customers_bank_id ON public.bank_customers(bank_id);
CREATE INDEX idx_bank_sourced_accounts_bank_id ON public.bank_sourced_accounts(bank_id);
CREATE INDEX idx_bank_sourced_accounts_customer_id ON public.bank_sourced_accounts(customer_id);
CREATE INDEX idx_bank_sourced_balances_account_id ON public.bank_sourced_balances(account_id);
CREATE INDEX idx_bank_sourced_transactions_account_id ON public.bank_sourced_transactions(account_id);
CREATE INDEX idx_bank_sourced_transactions_booking_date ON public.bank_sourced_transactions(booking_date);
CREATE INDEX idx_bank_sourced_beneficiaries_account_id ON public.bank_sourced_beneficiaries(account_id);
CREATE INDEX idx_bank_psu_links_user_id ON public.bank_psu_links(user_id);
CREATE INDEX idx_bank_psu_links_bank_id ON public.bank_psu_links(bank_id);
CREATE INDEX idx_bank_payments_bank_id ON public.bank_payments(bank_id);
CREATE INDEX idx_bank_payments_user_id ON public.bank_payments(user_id);
CREATE INDEX idx_bank_payments_status ON public.bank_payments(status);
CREATE INDEX idx_bank_payment_status_events_payment_id ON public.bank_payment_status_events(payment_id);

-- RLS
ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_connector_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_connector_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_connector_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_sourced_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_sourced_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_sourced_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_sourced_beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_psu_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_payment_status_events ENABLE ROW LEVEL SECURITY;

-- Banks: admin full CRUD, authenticated read active
CREATE POLICY "admin_banks_all" ON public.banks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "read_active_banks" ON public.banks FOR SELECT TO authenticated
  USING (status = 'active');

-- Bank branches: admin CRUD, authenticated read
CREATE POLICY "admin_bank_branches_all" ON public.bank_branches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "read_bank_branches" ON public.bank_branches FOR SELECT TO authenticated
  USING (is_active = true);

-- Connector instances: admin only
CREATE POLICY "admin_connector_instances" ON public.bank_connector_instances FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Connector certificates: admin only
CREATE POLICY "admin_connector_certs" ON public.bank_connector_certificates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Connector health: admin only
CREATE POLICY "admin_connector_health" ON public.bank_connector_health FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Bank customers: service_role only (ingestion)
CREATE POLICY "service_role_bank_customers" ON public.bank_customers FOR ALL TO service_role USING (true);
CREATE POLICY "admin_read_bank_customers" ON public.bank_customers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Bank sourced accounts: service_role + admin read
CREATE POLICY "service_role_bank_accounts" ON public.bank_sourced_accounts FOR ALL TO service_role USING (true);
CREATE POLICY "admin_read_bank_accounts" ON public.bank_sourced_accounts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Bank sourced balances: service_role + admin read
CREATE POLICY "service_role_bank_balances" ON public.bank_sourced_balances FOR ALL TO service_role USING (true);
CREATE POLICY "admin_read_bank_balances" ON public.bank_sourced_balances FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Bank sourced transactions: service_role + admin read
CREATE POLICY "service_role_bank_txns" ON public.bank_sourced_transactions FOR ALL TO service_role USING (true);
CREATE POLICY "admin_read_bank_txns" ON public.bank_sourced_transactions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Bank sourced beneficiaries: service_role + admin read
CREATE POLICY "service_role_bank_beneficiaries" ON public.bank_sourced_beneficiaries FOR ALL TO service_role USING (true);
CREATE POLICY "admin_read_bank_beneficiaries" ON public.bank_sourced_beneficiaries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- PSU links: user can manage own, admin can read all
CREATE POLICY "user_own_psu_links" ON public.bank_psu_links FOR ALL TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "admin_psu_links" ON public.bank_psu_links FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Bank payments: user own + admin
CREATE POLICY "user_own_bank_payments" ON public.bank_payments FOR ALL TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "admin_bank_payments" ON public.bank_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Payment status events: admin only
CREATE POLICY "admin_payment_events" ON public.bank_payment_status_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "service_role_payment_events" ON public.bank_payment_status_events FOR ALL TO service_role USING (true);
