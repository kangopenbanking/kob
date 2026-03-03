
-- ============================================================
-- Phase 4: Escrow Sub-Wallets, Safeguarding Ledger, SAR
-- ============================================================

-- 1. Escrow Wallets: ring-fenced sub-wallets for marketplace holds
CREATE TABLE public.escrow_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id),
  parent_wallet_id UUID NOT NULL REFERENCES public.accounts(id),
  escrow_label TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  held_amount NUMERIC NOT NULL DEFAULT 0,
  released_amount NUMERIC NOT NULL DEFAULT 0,
  refunded_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'frozen')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX idx_escrow_wallets_merchant ON public.escrow_wallets(merchant_id);
CREATE INDEX idx_escrow_wallets_parent ON public.escrow_wallets(parent_wallet_id);

ALTER TABLE public.escrow_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on escrow_wallets"
  ON public.escrow_wallets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Merchant read own escrow_wallets"
  ON public.escrow_wallets FOR SELECT TO authenticated
  USING (merchant_id IN (
    SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid()
  ));

-- 2. Escrow Transactions: movements in/out of escrow
CREATE TABLE public.escrow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_wallet_id UUID NOT NULL REFERENCES public.escrow_wallets(id),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('fund', 'release', 'refund', 'adjustment')),
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  reference TEXT,
  description TEXT,
  performed_by UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_escrow_tx_wallet ON public.escrow_transactions(escrow_wallet_id);
CREATE INDEX idx_escrow_tx_created ON public.escrow_transactions(created_at DESC);

ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on escrow_transactions"
  ON public.escrow_transactions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Merchant read own escrow_transactions"
  ON public.escrow_transactions FOR SELECT TO authenticated
  USING (escrow_wallet_id IN (
    SELECT ew.id FROM public.escrow_wallets ew
    JOIN public.gateway_merchants gm ON ew.merchant_id = gm.id
    WHERE gm.user_id = auth.uid()
  ));

-- 3. Safeguarding Ledger: segregated client fund tracking (e-money compliance)
CREATE TABLE public.safeguarding_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('client_receipt', 'client_payout', 'fee_deduction', 'interest_earned', 'reconciliation_adjustment', 'regulatory_reserve')),
  direction TEXT NOT NULL CHECK (direction IN ('inflow', 'outflow')),
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  running_balance NUMERIC NOT NULL DEFAULT 0,
  merchant_id UUID REFERENCES public.gateway_merchants(id),
  escrow_wallet_id UUID REFERENCES public.escrow_wallets(id),
  reference_type TEXT,  -- 'charge', 'payout', 'escrow', 'manual'
  reference_id UUID,
  description TEXT NOT NULL,
  reconciled BOOLEAN NOT NULL DEFAULT false,
  reconciled_at TIMESTAMPTZ,
  reconciled_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_safeguarding_created ON public.safeguarding_ledger(created_at DESC);
CREATE INDEX idx_safeguarding_merchant ON public.safeguarding_ledger(merchant_id);
CREATE INDEX idx_safeguarding_reconciled ON public.safeguarding_ledger(reconciled) WHERE NOT reconciled;

ALTER TABLE public.safeguarding_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on safeguarding_ledger"
  ON public.safeguarding_ledger FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Suspicious Activity Reports (SAR)
CREATE TABLE public.suspicious_activity_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_number TEXT NOT NULL UNIQUE,
  subject_user_id UUID,
  subject_merchant_id UUID REFERENCES public.gateway_merchants(id),
  subject_name TEXT NOT NULL,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('individual', 'merchant', 'institution')),
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'structuring', 'unusual_volume', 'sanctions_hit', 'identity_fraud',
    'money_laundering', 'terrorist_financing', 'fraud', 'bribery', 'other'
  )),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'escalated', 'closed_action_taken', 'closed_no_action')),
  summary TEXT NOT NULL,
  detailed_narrative TEXT,
  suspicious_transactions JSONB DEFAULT '[]',
  supporting_evidence JSONB DEFAULT '[]',
  risk_indicators JSONB DEFAULT '[]',
  amount_involved NUMERIC,
  currency TEXT DEFAULT 'XAF',
  activity_start_date DATE,
  activity_end_date DATE,
  filed_by UUID NOT NULL,
  filed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  escalated_to TEXT,
  escalated_at TIMESTAMPTZ,
  regulatory_reference TEXT,
  closed_at TIMESTAMPTZ,
  closure_notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sar_status ON public.suspicious_activity_reports(status);
CREATE INDEX idx_sar_severity ON public.suspicious_activity_reports(severity);
CREATE INDEX idx_sar_subject_user ON public.suspicious_activity_reports(subject_user_id);
CREATE INDEX idx_sar_subject_merchant ON public.suspicious_activity_reports(subject_merchant_id);
CREATE INDEX idx_sar_filed_at ON public.suspicious_activity_reports(filed_at DESC);

ALTER TABLE public.suspicious_activity_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on SARs"
  ON public.suspicious_activity_reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- SAR event log (audit trail for SAR lifecycle)
CREATE TABLE public.sar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sar_id UUID NOT NULL REFERENCES public.suspicious_activity_reports(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'submitted', 'reviewed', 'escalated', 'closed', 'note_added', 'evidence_attached')),
  performed_by UUID NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sar_events_sar ON public.sar_events(sar_id);

ALTER TABLE public.sar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on sar_events"
  ON public.sar_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Update trigger for escrow_wallets
CREATE OR REPLACE FUNCTION public.update_escrow_wallet_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_escrow_wallet_updated
  BEFORE UPDATE ON public.escrow_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_escrow_wallet_timestamp();

-- Update trigger for SARs
CREATE OR REPLACE FUNCTION public.update_sar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_sar_updated
  BEFORE UPDATE ON public.suspicious_activity_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_sar_timestamp();
