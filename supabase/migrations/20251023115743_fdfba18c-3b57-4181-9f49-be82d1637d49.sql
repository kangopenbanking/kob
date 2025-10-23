-- SWIFT Messages Table
CREATE TABLE IF NOT EXISTS public.swift_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES public.institutions(id),
  message_type TEXT NOT NULL CHECK (message_type IN ('MT103', 'MT940', 'MT202', 'MT910', 'MT950')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_content TEXT NOT NULL,
  parsed_data JSONB,
  sender_bic TEXT,
  receiver_bic TEXT,
  transaction_reference TEXT,
  value_date DATE,
  currency TEXT,
  amount NUMERIC(15,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'validated')),
  validation_errors JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

-- MT103 Payment Details Table
CREATE TABLE IF NOT EXISTS public.swift_mt103_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swift_message_id UUID REFERENCES public.swift_messages(id) ON DELETE CASCADE,
  transaction_reference TEXT NOT NULL,
  related_reference TEXT,
  bank_operation_code TEXT,
  value_date DATE NOT NULL,
  currency TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  ordering_customer JSONB NOT NULL,
  ordering_institution JSONB,
  sender_correspondent JSONB,
  receiver_correspondent JSONB,
  beneficiary_customer JSONB NOT NULL,
  beneficiary_institution JSONB,
  remittance_info TEXT,
  details_of_charges TEXT,
  sender_to_receiver_info TEXT,
  regulatory_reporting JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MT940 Statement Header Table
CREATE TABLE IF NOT EXISTS public.swift_mt940_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swift_message_id UUID REFERENCES public.swift_messages(id) ON DELETE CASCADE,
  transaction_reference TEXT NOT NULL,
  account_identification TEXT NOT NULL,
  statement_number TEXT NOT NULL,
  sequence_number TEXT,
  opening_balance NUMERIC(15,2) NOT NULL,
  opening_balance_date DATE NOT NULL,
  opening_balance_currency TEXT NOT NULL,
  opening_balance_dc_indicator TEXT NOT NULL CHECK (opening_balance_dc_indicator IN ('C', 'D')),
  closing_balance NUMERIC(15,2) NOT NULL,
  closing_balance_date DATE NOT NULL,
  closing_balance_currency TEXT NOT NULL,
  closing_balance_dc_indicator TEXT NOT NULL CHECK (closing_balance_dc_indicator IN ('C', 'D')),
  closing_available_balance NUMERIC(15,2),
  closing_available_balance_date DATE,
  forward_available_balance NUMERIC(15,2),
  forward_available_balance_date DATE,
  information_to_account_owner TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MT940 Statement Entries Table
CREATE TABLE IF NOT EXISTS public.swift_mt940_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mt940_statement_id UUID REFERENCES public.swift_mt940_statements(id) ON DELETE CASCADE,
  value_date DATE NOT NULL,
  entry_date DATE,
  dc_indicator TEXT NOT NULL CHECK (dc_indicator IN ('C', 'D', 'RC', 'RD')),
  funds_code TEXT,
  amount NUMERIC(15,2) NOT NULL,
  transaction_type TEXT NOT NULL,
  reference TEXT NOT NULL,
  account_servicing_ref TEXT,
  supplementary_details TEXT,
  transaction_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_swift_messages_institution ON public.swift_messages(institution_id);
CREATE INDEX IF NOT EXISTS idx_swift_messages_type ON public.swift_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_swift_messages_status ON public.swift_messages(status);
CREATE INDEX IF NOT EXISTS idx_swift_messages_created ON public.swift_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_swift_messages_sender_bic ON public.swift_messages(sender_bic);
CREATE INDEX IF NOT EXISTS idx_swift_messages_receiver_bic ON public.swift_messages(receiver_bic);
CREATE INDEX IF NOT EXISTS idx_swift_mt103_message ON public.swift_mt103_payments(swift_message_id);
CREATE INDEX IF NOT EXISTS idx_swift_mt103_reference ON public.swift_mt103_payments(transaction_reference);
CREATE INDEX IF NOT EXISTS idx_swift_mt940_message ON public.swift_mt940_statements(swift_message_id);
CREATE INDEX IF NOT EXISTS idx_swift_mt940_account ON public.swift_mt940_statements(account_identification);
CREATE INDEX IF NOT EXISTS idx_swift_mt940_entries_statement ON public.swift_mt940_entries(mt940_statement_id);

-- Enable Row Level Security
ALTER TABLE public.swift_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swift_mt103_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swift_mt940_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swift_mt940_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for swift_messages
CREATE POLICY "Admins can manage all SWIFT messages"
  ON public.swift_messages FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Institutions can view own SWIFT messages"
  ON public.swift_messages FOR SELECT
  USING (institution_id IN (
    SELECT id FROM public.institutions WHERE user_id = auth.uid()
  ));

CREATE POLICY "Institutions can create own SWIFT messages"
  ON public.swift_messages FOR INSERT
  WITH CHECK (institution_id IN (
    SELECT id FROM public.institutions WHERE user_id = auth.uid()
  ));

-- RLS Policies for swift_mt103_payments
CREATE POLICY "Admins can view all MT103 payments"
  ON public.swift_mt103_payments FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Institutions can view own MT103 payments"
  ON public.swift_mt103_payments FOR SELECT
  USING (swift_message_id IN (
    SELECT id FROM public.swift_messages 
    WHERE institution_id IN (
      SELECT id FROM public.institutions WHERE user_id = auth.uid()
    )
  ));

-- RLS Policies for swift_mt940_statements
CREATE POLICY "Admins can view all MT940 statements"
  ON public.swift_mt940_statements FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Institutions can view own MT940 statements"
  ON public.swift_mt940_statements FOR SELECT
  USING (swift_message_id IN (
    SELECT id FROM public.swift_messages 
    WHERE institution_id IN (
      SELECT id FROM public.institutions WHERE user_id = auth.uid()
    )
  ));

-- RLS Policies for swift_mt940_entries
CREATE POLICY "Admins can view all MT940 entries"
  ON public.swift_mt940_entries FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Institutions can view own MT940 entries"
  ON public.swift_mt940_entries FOR SELECT
  USING (mt940_statement_id IN (
    SELECT id FROM public.swift_mt940_statements
    WHERE swift_message_id IN (
      SELECT id FROM public.swift_messages 
      WHERE institution_id IN (
        SELECT id FROM public.institutions WHERE user_id = auth.uid()
      )
    )
  ));