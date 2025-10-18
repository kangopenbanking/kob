-- Phase 14: Bank Integration Layer Schema

-- Bank connection configurations table
CREATE TABLE IF NOT EXISTS public.bank_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  bank_code TEXT NOT NULL,
  connection_type TEXT NOT NULL CHECK (connection_type IN ('SFTP', 'H2H', 'REST_API', 'SOAP')),
  is_active BOOLEAN DEFAULT true,
  
  -- Connection details (encrypted in production)
  connection_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- API endpoints for REST connections
  base_url TEXT,
  auth_endpoint TEXT,
  
  -- SFTP/H2H details
  host TEXT,
  port INTEGER,
  username TEXT,
  
  -- File format configurations
  file_format TEXT CHECK (file_format IN ('MT940', 'CAMT053', 'CSV', 'JSON', 'XML')),
  
  -- Reconciliation settings
  auto_reconcile BOOLEAN DEFAULT false,
  reconciliation_frequency TEXT DEFAULT 'daily',
  
  -- Status tracking
  last_sync_at TIMESTAMP WITH TIME ZONE,
  last_sync_status TEXT,
  sync_error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bank transaction reconciliation table
CREATE TABLE IF NOT EXISTS public.bank_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_connection_id UUID NOT NULL REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  reconciliation_date DATE NOT NULL,
  
  -- Reconciliation summary
  total_bank_transactions INTEGER DEFAULT 0,
  total_system_transactions INTEGER DEFAULT 0,
  matched_count INTEGER DEFAULT 0,
  unmatched_bank_count INTEGER DEFAULT 0,
  unmatched_system_count INTEGER DEFAULT 0,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  
  -- Results
  reconciliation_report JSONB,
  discrepancies JSONB,
  
  -- Execution info
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bank transaction import log
CREATE TABLE IF NOT EXISTS public.bank_transaction_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_connection_id UUID NOT NULL REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  
  -- File details
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  
  -- Import summary
  total_records INTEGER DEFAULT 0,
  successful_imports INTEGER DEFAULT 0,
  failed_imports INTEGER DEFAULT 0,
  duplicate_records INTEGER DEFAULT 0,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  
  -- Import data
  import_data JSONB,
  error_details JSONB,
  
  imported_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Bank statement files storage metadata
CREATE TABLE IF NOT EXISTS public.bank_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_connection_id UUID NOT NULL REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  
  statement_date DATE NOT NULL,
  statement_period_start DATE,
  statement_period_end DATE,
  
  -- File information
  file_name TEXT NOT NULL,
  file_path TEXT,
  file_format TEXT,
  file_size INTEGER,
  
  -- Statement summary
  opening_balance NUMERIC(15,2),
  closing_balance NUMERIC(15,2),
  total_credits NUMERIC(15,2),
  total_debits NUMERIC(15,2),
  transaction_count INTEGER,
  
  -- Processing status
  is_processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transaction_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bank_connections
CREATE POLICY "Admins can manage all bank connections"
  ON public.bank_connections FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Institutions can view own bank connections"
  ON public.bank_connections FOR SELECT
  USING (
    institution_id IN (
      SELECT id FROM public.institutions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Institutions can create own bank connections"
  ON public.bank_connections FOR INSERT
  WITH CHECK (
    institution_id IN (
      SELECT id FROM public.institutions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Institutions can update own bank connections"
  ON public.bank_connections FOR UPDATE
  USING (
    institution_id IN (
      SELECT id FROM public.institutions WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for bank_reconciliations
CREATE POLICY "Admins can view all reconciliations"
  ON public.bank_reconciliations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Institutions can view own reconciliations"
  ON public.bank_reconciliations FOR SELECT
  USING (
    bank_connection_id IN (
      SELECT bc.id FROM public.bank_connections bc
      JOIN public.institutions i ON bc.institution_id = i.id
      WHERE i.user_id = auth.uid()
    )
  );

-- RLS Policies for bank_transaction_imports
CREATE POLICY "Admins can view all imports"
  ON public.bank_transaction_imports FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Institutions can view own imports"
  ON public.bank_transaction_imports FOR SELECT
  USING (
    bank_connection_id IN (
      SELECT bc.id FROM public.bank_connections bc
      JOIN public.institutions i ON bc.institution_id = i.id
      WHERE i.user_id = auth.uid()
    )
  );

CREATE POLICY "Institutions can create own imports"
  ON public.bank_transaction_imports FOR INSERT
  WITH CHECK (
    bank_connection_id IN (
      SELECT bc.id FROM public.bank_connections bc
      JOIN public.institutions i ON bc.institution_id = i.id
      WHERE i.user_id = auth.uid()
    )
  );

-- RLS Policies for bank_statements
CREATE POLICY "Admins can view all statements"
  ON public.bank_statements FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Institutions can view own statements"
  ON public.bank_statements FOR SELECT
  USING (
    bank_connection_id IN (
      SELECT bc.id FROM public.bank_connections bc
      JOIN public.institutions i ON bc.institution_id = i.id
      WHERE i.user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX idx_bank_connections_institution ON public.bank_connections(institution_id);
CREATE INDEX idx_bank_connections_active ON public.bank_connections(is_active) WHERE is_active = true;
CREATE INDEX idx_bank_reconciliations_connection ON public.bank_reconciliations(bank_connection_id);
CREATE INDEX idx_bank_reconciliations_date ON public.bank_reconciliations(reconciliation_date);
CREATE INDEX idx_bank_transaction_imports_connection ON public.bank_transaction_imports(bank_connection_id);
CREATE INDEX idx_bank_statements_connection ON public.bank_statements(bank_connection_id);
CREATE INDEX idx_bank_statements_date ON public.bank_statements(statement_date);

-- Function to update bank connection sync status
CREATE OR REPLACE FUNCTION public.update_bank_sync_status(
  _connection_id UUID,
  _status TEXT,
  _error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.bank_connections
  SET 
    last_sync_at = NOW(),
    last_sync_status = _status,
    sync_error_message = _error_message,
    updated_at = NOW()
  WHERE id = _connection_id;
END;
$$;