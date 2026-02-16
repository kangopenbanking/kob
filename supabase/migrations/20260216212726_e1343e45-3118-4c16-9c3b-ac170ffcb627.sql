
-- ============================================
-- CHECKPOINT 4: Missing Tables Migration
-- ============================================

-- 1. Idempotency Keys
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  idempotency_key TEXT NOT NULL,
  client_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  response_status INTEGER,
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  UNIQUE(idempotency_key, client_id, endpoint)
);

CREATE INDEX idx_idempotency_keys_lookup ON public.idempotency_keys (idempotency_key, client_id, endpoint);
CREATE INDEX idx_idempotency_keys_expires ON public.idempotency_keys (expires_at);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on idempotency_keys"
  ON public.idempotency_keys FOR ALL
  USING (true) WITH CHECK (true);

-- 2. Ledger Accounts
CREATE TABLE IF NOT EXISTS public.ledger_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_code TEXT NOT NULL UNIQUE,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL, -- asset, liability, equity, revenue, expense
  currency TEXT NOT NULL DEFAULT 'XAF',
  balance NUMERIC NOT NULL DEFAULT 0,
  institution_id UUID REFERENCES public.institutions(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  parent_account_id UUID REFERENCES public.ledger_accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ledger_accounts_type ON public.ledger_accounts (account_type);
CREATE INDEX idx_ledger_accounts_institution ON public.ledger_accounts (institution_id);

ALTER TABLE public.ledger_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ledger accounts"
  ON public.ledger_accounts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Institution users view own ledger accounts"
  ON public.ledger_accounts FOR SELECT
  USING (
    institution_id IN (
      SELECT id FROM public.institutions WHERE user_id = auth.uid()
    )
  );

-- 3. Journal Entries
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_number TEXT NOT NULL UNIQUE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  reference_type TEXT, -- payment, loan, savings, manual
  reference_id UUID,
  institution_id UUID REFERENCES public.institutions(id),
  posted_by UUID,
  is_reversed BOOLEAN NOT NULL DEFAULT false,
  reversal_of UUID REFERENCES public.journal_entries(id),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_journal_entries_date ON public.journal_entries (entry_date);
CREATE INDEX idx_journal_entries_reference ON public.journal_entries (reference_type, reference_id);
CREATE INDEX idx_journal_entries_institution ON public.journal_entries (institution_id);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage journal entries"
  ON public.journal_entries FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Institution users view own journal entries"
  ON public.journal_entries FOR SELECT
  USING (
    institution_id IN (
      SELECT id FROM public.institutions WHERE user_id = auth.uid()
    )
  );

-- 4. Journal Lines
CREATE TABLE IF NOT EXISTS public.journal_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  ledger_account_id UUID NOT NULL REFERENCES public.ledger_accounts(id),
  debit NUMERIC NOT NULL DEFAULT 0,
  credit NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_journal_lines_entry ON public.journal_lines (journal_entry_id);
CREATE INDEX idx_journal_lines_account ON public.journal_lines (ledger_account_id);

ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage journal lines"
  ON public.journal_lines FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Institution users view own journal lines"
  ON public.journal_lines FOR SELECT
  USING (
    journal_entry_id IN (
      SELECT id FROM public.journal_entries
      WHERE institution_id IN (
        SELECT id FROM public.institutions WHERE user_id = auth.uid()
      )
    )
  );

-- 5. Loan Schedule
CREATE TABLE IF NOT EXISTS public.loan_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loan_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  principal_amount NUMERIC NOT NULL DEFAULT 0,
  interest_amount NUMERIC NOT NULL DEFAULT 0,
  fee_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, partial, overdue, waived
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(loan_id, installment_number)
);

CREATE INDEX idx_loan_schedule_loan ON public.loan_schedule (loan_id);
CREATE INDEX idx_loan_schedule_due ON public.loan_schedule (due_date, status);

ALTER TABLE public.loan_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage loan schedule"
  ON public.loan_schedule FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own loan schedule"
  ON public.loan_schedule FOR SELECT
  USING (
    loan_id IN (
      SELECT id FROM public.loan_applications WHERE user_id = auth.uid()
    )
  );

-- 6. Loan Repayments
CREATE TABLE IF NOT EXISTS public.loan_repayments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loan_id UUID NOT NULL REFERENCES public.loan_applications(id),
  schedule_id UUID REFERENCES public.loan_schedule(id),
  amount NUMERIC NOT NULL,
  principal_paid NUMERIC NOT NULL DEFAULT 0,
  interest_paid NUMERIC NOT NULL DEFAULT 0,
  fees_paid NUMERIC NOT NULL DEFAULT 0,
  penalty_paid NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT, -- mobile_money, bank_transfer, cash
  payment_reference TEXT,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_loan_repayments_loan ON public.loan_repayments (loan_id);
CREATE INDEX idx_loan_repayments_schedule ON public.loan_repayments (schedule_id);

ALTER TABLE public.loan_repayments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage loan repayments"
  ON public.loan_repayments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own loan repayments"
  ON public.loan_repayments FOR SELECT
  USING (
    loan_id IN (
      SELECT id FROM public.loan_applications WHERE user_id = auth.uid()
    )
  );

-- 7. Loan Events
CREATE TABLE IF NOT EXISTS public.loan_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loan_id UUID NOT NULL REFERENCES public.loan_applications(id),
  event_type TEXT NOT NULL, -- applied, approved, rejected, disbursed, repayment, defaulted, completed, written_off
  performed_by UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_loan_events_loan ON public.loan_events (loan_id);
CREATE INDEX idx_loan_events_type ON public.loan_events (event_type);

ALTER TABLE public.loan_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage loan events"
  ON public.loan_events FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own loan events"
  ON public.loan_events FOR SELECT
  USING (
    loan_id IN (
      SELECT id FROM public.loan_applications WHERE user_id = auth.uid()
    )
  );

-- 8. Interest Accruals
CREATE TABLE IF NOT EXISTS public.interest_accruals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  savings_account_id UUID NOT NULL REFERENCES public.savings_accounts(id),
  accrual_date DATE NOT NULL,
  interest_rate NUMERIC NOT NULL,
  accrued_amount NUMERIC NOT NULL,
  balance_before NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_interest_accruals_account ON public.interest_accruals (savings_account_id);
CREATE INDEX idx_interest_accruals_date ON public.interest_accruals (accrual_date);

ALTER TABLE public.interest_accruals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage interest accruals"
  ON public.interest_accruals FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own interest accruals"
  ON public.interest_accruals FOR SELECT
  USING (
    savings_account_id IN (
      SELECT id FROM public.savings_accounts WHERE user_id = auth.uid()
    )
  );

-- 9. Payment Events
CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.payments(id),
  event_type TEXT NOT NULL, -- created, authorized, submitted, completed, failed, cancelled
  previous_status TEXT,
  new_status TEXT,
  performed_by UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_events_payment ON public.payment_events (payment_id);
CREATE INDEX idx_payment_events_type ON public.payment_events (event_type);

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage payment events"
  ON public.payment_events FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own payment events"
  ON public.payment_events FOR SELECT
  USING (
    payment_id IN (
      SELECT id FROM public.payments WHERE user_id = auth.uid()
    )
  );

-- 10. Payment Routes
CREATE TABLE IF NOT EXISTS public.payment_routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.payments(id),
  rail TEXT NOT NULL, -- flutterwave, mobile_money, bank_transfer, stripe
  external_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_number INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_routes_payment ON public.payment_routes (payment_id);
CREATE INDEX idx_payment_routes_rail ON public.payment_routes (rail, status);

ALTER TABLE public.payment_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage payment routes"
  ON public.payment_routes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 11. Webhook Inbox (deduplication)
CREATE TABLE IF NOT EXISTS public.webhook_inbox (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL, -- flutterwave, stripe, mobile_money
  event_id TEXT, -- external event ID for dedup
  payload JSONB NOT NULL,
  signature TEXT,
  is_processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source, event_id)
);

CREATE INDEX idx_webhook_inbox_source ON public.webhook_inbox (source, is_processed);
CREATE INDEX idx_webhook_inbox_event ON public.webhook_inbox (event_id);

ALTER TABLE public.webhook_inbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on webhook_inbox"
  ON public.webhook_inbox FOR ALL
  USING (true) WITH CHECK (true);

-- 12. Cleanup function for expired idempotency keys
CREATE OR REPLACE FUNCTION public.cleanup_expired_idempotency_keys()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.idempotency_keys WHERE expires_at < NOW();
END;
$$;

-- 13. Trigger for updated_at on ledger_accounts
CREATE TRIGGER update_ledger_accounts_updated_at
  BEFORE UPDATE ON public.ledger_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 14. Trigger for updated_at on loan_schedule
CREATE TRIGGER update_loan_schedule_updated_at
  BEFORE UPDATE ON public.loan_schedule
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 15. Trigger for updated_at on payment_routes
CREATE TRIGGER update_payment_routes_updated_at
  BEFORE UPDATE ON public.payment_routes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
