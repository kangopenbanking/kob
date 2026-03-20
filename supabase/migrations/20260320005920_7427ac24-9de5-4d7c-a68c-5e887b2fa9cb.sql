
-- ============================================================
-- KOB Interbank Engine — Phase 2 + Phase 3 Data Model
-- 7 new tables: interbank_participants, interbank_endpoints,
-- interbank_payments, interbank_messages, interbank_status_events,
-- interbank_reconciliation_items, event_outbox
-- ============================================================

-- Enums
CREATE TYPE public.interbank_participant_type AS ENUM ('bank', 'credit_union', 'switch_partner');
CREATE TYPE public.interbank_participant_status AS ENUM ('draft', 'active', 'suspended');
CREATE TYPE public.interbank_settlement_mode AS ENUM ('prefunded', 'net_settlement', 'manual');
CREATE TYPE public.interbank_env AS ENUM ('sandbox', 'prod');
CREATE TYPE public.interbank_delivery_mode AS ENUM ('message_queue', 'https_push', 'file');
CREATE TYPE public.interbank_payment_status AS ENUM ('created', 'validated', 'submitted', 'accepted', 'rejected', 'in_process', 'settled', 'failed', 'reversed', 'expired');
CREATE TYPE public.interbank_initiated_by AS ENUM ('tpp', 'bank', 'merchant', 'admin', 'system');
CREATE TYPE public.interbank_message_direction AS ENUM ('outbound', 'inbound');
CREATE TYPE public.interbank_message_type AS ENUM ('pacs.008', 'pacs.002', 'camt.054', 'camt.053', 'pain.001', 'custom');
CREATE TYPE public.interbank_payload_format AS ENUM ('xml', 'json');
CREATE TYPE public.interbank_message_status AS ENUM ('stored', 'validated', 'processed', 'failed');
CREATE TYPE public.interbank_event_source AS ENUM ('engine', 'connector', 'admin', 'reconciliation');
CREATE TYPE public.interbank_recon_status AS ENUM ('open', 'investigating', 'resolved');
CREATE TYPE public.outbox_status AS ENUM ('pending', 'delivered', 'failed', 'dead_letter');

-- 1) interbank_participants
CREATE TABLE public.interbank_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.interbank_participant_type NOT NULL DEFAULT 'bank',
  participant_code TEXT NOT NULL UNIQUE,
  legal_name TEXT NOT NULL,
  display_name TEXT,
  status public.interbank_participant_status NOT NULL DEFAULT 'draft',
  settlement_mode public.interbank_settlement_mode NOT NULL DEFAULT 'prefunded',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.interbank_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access interbank_participants" ON public.interbank_participants FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) interbank_endpoints
CREATE TABLE public.interbank_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.interbank_participants(id) ON DELETE CASCADE,
  env public.interbank_env NOT NULL DEFAULT 'sandbox',
  connector_instance_id UUID,
  delivery_mode public.interbank_delivery_mode NOT NULL DEFAULT 'https_push',
  base_url TEXT,
  queue_name TEXT,
  hmac_secret_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_seen_at TIMESTAMPTZ,
  error_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.interbank_endpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access interbank_endpoints" ON public.interbank_endpoints FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) interbank_payments
CREATE TABLE public.interbank_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_reference TEXT,
  idempotency_key TEXT,
  initiated_by public.interbank_initiated_by NOT NULL DEFAULT 'admin',
  debtor_participant_id UUID NOT NULL REFERENCES public.interbank_participants(id),
  creditor_participant_id UUID NOT NULL REFERENCES public.interbank_participants(id),
  debtor_account_ref TEXT NOT NULL,
  creditor_account_ref TEXT NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  purpose TEXT,
  remittance_info TEXT,
  status public.interbank_payment_status NOT NULL DEFAULT 'created',
  scheme TEXT NOT NULL DEFAULT 'KOB_INTERBANK',
  requested_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  error_code TEXT,
  error_message TEXT,
  correlation_id UUID DEFAULT gen_random_uuid(),
  trace_id UUID DEFAULT gen_random_uuid(),
  ledger_hold_id UUID,
  ledger_journal_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(external_reference, debtor_participant_id)
);

CREATE INDEX idx_interbank_payments_status ON public.interbank_payments(status);
CREATE INDEX idx_interbank_payments_correlation ON public.interbank_payments(correlation_id);
CREATE INDEX idx_interbank_payments_idempotency ON public.interbank_payments(idempotency_key);
CREATE INDEX idx_interbank_payments_debtor ON public.interbank_payments(debtor_participant_id);
CREATE INDEX idx_interbank_payments_creditor ON public.interbank_payments(creditor_participant_id);

ALTER TABLE public.interbank_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access interbank_payments" ON public.interbank_payments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role interbank_payments" ON public.interbank_payments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4) interbank_messages
CREATE TABLE public.interbank_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES public.interbank_payments(id) ON DELETE SET NULL,
  direction public.interbank_message_direction NOT NULL,
  message_type public.interbank_message_type NOT NULL,
  message_id TEXT NOT NULL UNIQUE,
  correlation_id UUID,
  payload_format public.interbank_payload_format NOT NULL DEFAULT 'xml',
  payload_raw TEXT NOT NULL,
  signature_valid BOOLEAN,
  received_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  status public.interbank_message_status NOT NULL DEFAULT 'stored',
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_interbank_messages_payment ON public.interbank_messages(payment_id);
CREATE INDEX idx_interbank_messages_type ON public.interbank_messages(message_type);
CREATE INDEX idx_interbank_messages_correlation ON public.interbank_messages(correlation_id);

ALTER TABLE public.interbank_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access interbank_messages" ON public.interbank_messages FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role interbank_messages" ON public.interbank_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5) interbank_status_events
CREATE TABLE public.interbank_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.interbank_payments(id) ON DELETE CASCADE,
  status_from public.interbank_payment_status,
  status_to public.interbank_payment_status NOT NULL,
  source public.interbank_event_source NOT NULL DEFAULT 'engine',
  event_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  details_json JSONB DEFAULT '{}',
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_interbank_status_events_payment ON public.interbank_status_events(payment_id);

ALTER TABLE public.interbank_status_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access interbank_status_events" ON public.interbank_status_events FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role interbank_status_events" ON public.interbank_status_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6) interbank_reconciliation_items
CREATE TABLE public.interbank_reconciliation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.interbank_participants(id),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  expected_total NUMERIC(18,2) NOT NULL DEFAULT 0,
  actual_total NUMERIC(18,2) NOT NULL DEFAULT 0,
  mismatch_count INT NOT NULL DEFAULT 0,
  status public.interbank_recon_status NOT NULL DEFAULT 'open',
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.interbank_reconciliation_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access interbank_reconciliation_items" ON public.interbank_reconciliation_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 7) event_outbox
CREATE TABLE public.event_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status public.outbox_status NOT NULL DEFAULT 'pending',
  retries INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 7,
  next_retry_at TIMESTAMPTZ DEFAULT now(),
  correlation_id UUID,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_event_outbox_status ON public.event_outbox(status);
CREATE INDEX idx_event_outbox_next_retry ON public.event_outbox(next_retry_at) WHERE status IN ('pending', 'failed');

ALTER TABLE public.event_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only event_outbox" ON public.event_outbox FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Enable realtime for interbank_payments and interbank_status_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.interbank_payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.interbank_status_events;
