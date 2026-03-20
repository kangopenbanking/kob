
-- ═══════════════════════════════════════════════════════════════
-- DB Connector + Message Queue Connector Tables
-- ═══════════════════════════════════════════════════════════════

-- 1. DB Connector Configurations
CREATE TABLE public.bank_db_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  connector_instance_id UUID REFERENCES public.bank_connector_instances(id),
  name TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'sandbox',
  db_type TEXT NOT NULL DEFAULT 'postgresql',
  connection_config_encrypted JSONB NOT NULL DEFAULT '{}',
  poll_interval_seconds INTEGER NOT NULL DEFAULT 300,
  last_poll_at TIMESTAMPTZ,
  last_poll_status TEXT DEFAULT 'pending',
  last_poll_error TEXT,
  poll_query_accounts TEXT,
  poll_query_transactions TEXT,
  poll_query_balances TEXT,
  poll_query_beneficiaries TEXT,
  watermark_column TEXT DEFAULT 'updated_at',
  watermark_value TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_db_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage db connections"
  ON public.bank_db_connections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. DB Connector Sync Runs
CREATE TABLE public.bank_db_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.bank_db_connections(id) ON DELETE CASCADE,
  bank_id UUID NOT NULL REFERENCES public.banks(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  accounts_synced INTEGER DEFAULT 0,
  transactions_synced INTEGER DEFAULT 0,
  balances_synced INTEGER DEFAULT 0,
  beneficiaries_synced INTEGER DEFAULT 0,
  errors_json JSONB DEFAULT '[]',
  watermark_before TEXT,
  watermark_after TEXT,
  correlation_id TEXT DEFAULT gen_random_uuid()::text
);

ALTER TABLE public.bank_db_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view sync runs"
  ON public.bank_db_sync_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Message Queue Channels
CREATE TABLE public.bank_mq_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  connector_instance_id UUID REFERENCES public.bank_connector_instances(id),
  channel_name TEXT NOT NULL,
  channel_type TEXT NOT NULL DEFAULT 'realtime',
  direction TEXT NOT NULL DEFAULT 'inbound',
  topic_filter TEXT DEFAULT '*',
  webhook_url TEXT,
  webhook_secret_hash TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_message_at TIMESTAMPTZ,
  message_count BIGINT DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(bank_id, channel_name)
);

ALTER TABLE public.bank_mq_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage mq channels"
  ON public.bank_mq_channels FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Message Queue Events (inbound/outbound messages)
CREATE TABLE public.bank_mq_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.bank_mq_channels(id) ON DELETE CASCADE,
  bank_id UUID NOT NULL REFERENCES public.banks(id),
  message_type TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'inbound',
  payload JSONB NOT NULL,
  correlation_id TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(channel_id, correlation_id)
);

ALTER TABLE public.bank_mq_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages mq messages"
  ON public.bank_mq_messages FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admin can view mq messages"
  ON public.bank_mq_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Enable realtime on message queue tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.bank_mq_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bank_mq_channels;

-- Indexes
CREATE INDEX idx_bank_db_connections_bank ON public.bank_db_connections(bank_id);
CREATE INDEX idx_bank_db_sync_runs_connection ON public.bank_db_sync_runs(connection_id);
CREATE INDEX idx_bank_db_sync_runs_status ON public.bank_db_sync_runs(status);
CREATE INDEX idx_bank_mq_channels_bank ON public.bank_mq_channels(bank_id);
CREATE INDEX idx_bank_mq_messages_channel ON public.bank_mq_messages(channel_id);
CREATE INDEX idx_bank_mq_messages_status ON public.bank_mq_messages(status);
CREATE INDEX idx_bank_mq_messages_created ON public.bank_mq_messages(created_at DESC);
