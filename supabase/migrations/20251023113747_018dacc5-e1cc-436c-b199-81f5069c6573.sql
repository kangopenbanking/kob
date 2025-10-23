-- ISO 20022 message repository
CREATE TABLE iso20022_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL UNIQUE,
  message_type TEXT NOT NULL,
  message_version TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'received', 'failed', 'rejected')),
  raw_xml TEXT NOT NULL,
  parsed_data JSONB NOT NULL,
  business_message_id TEXT,
  creation_date_time TIMESTAMPTZ NOT NULL,
  debtor_name TEXT,
  debtor_account TEXT,
  debtor_iban TEXT,
  creditor_name TEXT,
  creditor_account TEXT,
  creditor_iban TEXT,
  amount NUMERIC,
  currency TEXT,
  payment_reference TEXT,
  end_to_end_id TEXT,
  transaction_id TEXT,
  instruction_id TEXT,
  related_message_id TEXT,
  validation_errors JSONB,
  processing_errors JSONB,
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ISO 20022 payment instructions (from pain.001)
CREATE TABLE iso20022_payment_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES iso20022_messages(id) ON DELETE CASCADE,
  payment_information_id TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  batch_booking BOOLEAN,
  requested_execution_date DATE,
  debtor_name TEXT NOT NULL,
  debtor_account TEXT NOT NULL,
  debtor_iban TEXT,
  debtor_bic TEXT,
  debtor_agent_bic TEXT,
  total_interbank_settlement_amount NUMERIC NOT NULL,
  total_interbank_settlement_currency TEXT NOT NULL,
  number_of_transactions INTEGER NOT NULL,
  charge_bearer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ISO 20022 credit transfer transactions (from pain.001 / pacs.008)
CREATE TABLE iso20022_credit_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_instruction_id UUID REFERENCES iso20022_payment_instructions(id) ON DELETE CASCADE,
  message_id UUID REFERENCES iso20022_messages(id) ON DELETE CASCADE,
  payment_id TEXT NOT NULL,
  end_to_end_id TEXT NOT NULL,
  instruction_id TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  creditor_name TEXT NOT NULL,
  creditor_account TEXT NOT NULL,
  creditor_iban TEXT,
  creditor_bic TEXT,
  creditor_agent_bic TEXT,
  remittance_information TEXT,
  purpose_code TEXT,
  category_purpose_code TEXT,
  charge_bearer TEXT,
  status TEXT DEFAULT 'pending',
  status_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ISO 20022 account statements (camt.053)
CREATE TABLE iso20022_account_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES iso20022_messages(id) ON DELETE CASCADE,
  statement_id TEXT NOT NULL,
  account_iban TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_currency TEXT NOT NULL,
  statement_date DATE NOT NULL,
  opening_balance NUMERIC NOT NULL,
  closing_balance NUMERIC NOT NULL,
  number_of_entries INTEGER,
  total_credit_entries NUMERIC,
  total_debit_entries NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ISO 20022 statement entries (from camt.053)
CREATE TABLE iso20022_statement_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id UUID REFERENCES iso20022_account_statements(id) ON DELETE CASCADE,
  entry_reference TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  credit_debit_indicator TEXT NOT NULL CHECK (credit_debit_indicator IN ('CRDT', 'DBIT')),
  status TEXT NOT NULL CHECK (status IN ('BOOK', 'PDNG', 'INFO')),
  booking_date DATE,
  value_date DATE,
  account_servicer_reference TEXT,
  debtor_name TEXT,
  debtor_account TEXT,
  creditor_name TEXT,
  creditor_account TEXT,
  remittance_information TEXT,
  transaction_id TEXT,
  end_to_end_id TEXT,
  mandate_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE iso20022_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE iso20022_payment_instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE iso20022_credit_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE iso20022_account_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE iso20022_statement_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Admins can manage all ISO 20022 data
CREATE POLICY "Admins can manage ISO 20022 messages"
  ON iso20022_messages FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage payment instructions"
  ON iso20022_payment_instructions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage credit transfers"
  ON iso20022_credit_transfers FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage account statements"
  ON iso20022_account_statements FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage statement entries"
  ON iso20022_statement_entries FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Indexes for performance
CREATE INDEX idx_iso20022_messages_type ON iso20022_messages(message_type);
CREATE INDEX idx_iso20022_messages_status ON iso20022_messages(status);
CREATE INDEX idx_iso20022_messages_created_at ON iso20022_messages(created_at DESC);
CREATE INDEX idx_iso20022_messages_message_id ON iso20022_messages(message_id);
CREATE INDEX idx_iso20022_credit_transfers_end_to_end_id ON iso20022_credit_transfers(end_to_end_id);
CREATE INDEX idx_iso20022_statement_entries_transaction_id ON iso20022_statement_entries(transaction_id);
CREATE INDEX idx_iso20022_payment_instructions_message_id ON iso20022_payment_instructions(message_id);
CREATE INDEX idx_iso20022_credit_transfers_message_id ON iso20022_credit_transfers(message_id);

-- Trigger for updated_at
CREATE TRIGGER update_iso20022_messages_updated_at
  BEFORE UPDATE ON iso20022_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_iso20022_payment_instructions_updated_at
  BEFORE UPDATE ON iso20022_payment_instructions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_iso20022_credit_transfers_updated_at
  BEFORE UPDATE ON iso20022_credit_transfers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_iso20022_account_statements_updated_at
  BEFORE UPDATE ON iso20022_account_statements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_iso20022_statement_entries_updated_at
  BEFORE UPDATE ON iso20022_statement_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();