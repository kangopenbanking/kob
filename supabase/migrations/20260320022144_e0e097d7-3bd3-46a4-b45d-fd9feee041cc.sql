
-- ═══════════════════════════════════════════════════════════
-- Phase 1: File-Based Bank Connector — Tables + Storage
-- ═══════════════════════════════════════════════════════════

-- 1. bank_file_uploads — registry of all files uploaded by banks
CREATE TABLE public.bank_file_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'prod')),
  file_type TEXT NOT NULL CHECK (file_type IN ('accounts', 'balances', 'transactions', 'beneficiaries', 'payment_instructions', 'payment_status', 'statement')),
  original_filename TEXT NOT NULL,
  storage_path TEXT,
  file_hash_sha256 TEXT NOT NULL,
  file_size BIGINT,
  uploaded_by TEXT NOT NULL DEFAULT 'portal' CHECK (uploaded_by IN ('sftp', 'portal', 'admin')),
  uploader_user_id UUID,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'validating', 'processed', 'failed')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  correlation_id TEXT DEFAULT gen_random_uuid()::text,
  error_id TEXT,
  error_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_bank_file_uploads_dedupe ON public.bank_file_uploads (bank_id, file_type, file_hash_sha256);

ALTER TABLE public.bank_file_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage bank file uploads" ON public.bank_file_uploads
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access to bank_file_uploads" ON public.bank_file_uploads
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. bank_file_rows — row-level traceability per ingested file
CREATE TABLE public.bank_file_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES public.bank_file_uploads(id) ON DELETE CASCADE,
  row_number INT NOT NULL,
  raw_json JSONB,
  normalized_json JSONB,
  status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'invalid', 'duplicate', 'skipped')),
  error_id TEXT,
  error_details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_file_rows_file ON public.bank_file_rows (file_id);

ALTER TABLE public.bank_file_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to bank_file_rows" ON public.bank_file_rows
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins can read bank_file_rows" ON public.bank_file_rows
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. bank_data_mappings — per-bank CSV field mapping profiles
CREATE TABLE public.bank_data_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  file_type TEXT NOT NULL CHECK (file_type IN ('accounts', 'balances', 'transactions', 'beneficiaries', 'payment_instructions', 'payment_status')),
  version INT NOT NULL DEFAULT 1,
  mapping_json JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_bank_data_mappings_active ON public.bank_data_mappings (bank_id, file_type) WHERE is_active = true;

ALTER TABLE public.bank_data_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage bank_data_mappings" ON public.bank_data_mappings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access to bank_data_mappings" ON public.bank_data_mappings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. ingestion_runs — summary of each ingestion job
CREATE TABLE public.ingestion_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES public.bank_file_uploads(id) ON DELETE CASCADE,
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  totals_json JSONB NOT NULL DEFAULT '{"rows_total":0,"rows_ok":0,"rows_invalid":0,"rows_duplicate":0}',
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  correlation_id TEXT DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ingestion_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read ingestion_runs" ON public.ingestion_runs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access to ingestion_runs" ON public.ingestion_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. bank_batch_jobs — batch payment instruction generation
CREATE TABLE public.bank_batch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'prod')),
  batch_type TEXT NOT NULL DEFAULT 'outgoing_transfers' CHECK (batch_type IN ('outgoing_transfers', 'salary', 'merchant_payouts')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'delivered', 'executed', 'partially_failed', 'failed', 'reconciled')),
  created_by UUID,
  file_id UUID REFERENCES public.bank_file_uploads(id),
  totals_json JSONB NOT NULL DEFAULT '{"count":0,"total_amount":0}',
  correlation_id TEXT DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_batch_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage bank_batch_jobs" ON public.bank_batch_jobs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access to bank_batch_jobs" ON public.bank_batch_jobs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. bank_batch_items — individual payment instructions in a batch
CREATE TABLE public.bank_batch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.bank_batch_jobs(id) ON DELETE CASCADE,
  beneficiary_name TEXT NOT NULL,
  beneficiary_account_number TEXT NOT NULL,
  beneficiary_bank_code TEXT,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'XAF',
  narration TEXT,
  reference TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  internal_payment_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'executed', 'failed')),
  bank_response_code TEXT,
  bank_response_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_batch_items_batch ON public.bank_batch_items (batch_id);
CREATE INDEX idx_bank_batch_items_ref ON public.bank_batch_items (reference);

ALTER TABLE public.bank_batch_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage bank_batch_items" ON public.bank_batch_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access to bank_batch_items" ON public.bank_batch_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7. bank_status_events — status file ingestion events per batch item
CREATE TABLE public.bank_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_item_id UUID NOT NULL REFERENCES public.bank_batch_items(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  bank_tx_id TEXT,
  raw_row_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_status_events_item ON public.bank_status_events (batch_item_id);

ALTER TABLE public.bank_status_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to bank_status_events" ON public.bank_status_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins can read bank_status_events" ON public.bank_status_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════════════════════════════
-- ALTER existing bank_sourced_* tables: add source_file_id + source_row_number
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.bank_sourced_accounts
  ADD COLUMN IF NOT EXISTS source_file_id UUID REFERENCES public.bank_file_uploads(id),
  ADD COLUMN IF NOT EXISTS source_row_number INT;

ALTER TABLE public.bank_sourced_transactions
  ADD COLUMN IF NOT EXISTS source_file_id UUID REFERENCES public.bank_file_uploads(id),
  ADD COLUMN IF NOT EXISTS source_row_number INT;

ALTER TABLE public.bank_sourced_balances
  ADD COLUMN IF NOT EXISTS source_file_id UUID REFERENCES public.bank_file_uploads(id),
  ADD COLUMN IF NOT EXISTS source_row_number INT;

ALTER TABLE public.bank_sourced_beneficiaries
  ADD COLUMN IF NOT EXISTS source_file_id UUID REFERENCES public.bank_file_uploads(id),
  ADD COLUMN IF NOT EXISTS source_row_number INT;

-- ═══════════════════════════════════════════════════════════
-- Storage bucket for bank files
-- ═══════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('bank-files', 'bank-files', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: admin can upload/read
CREATE POLICY "Admins can upload bank files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bank-files' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read bank files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'bank-files' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access to bank files" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'bank-files')
  WITH CHECK (bucket_id = 'bank-files');
