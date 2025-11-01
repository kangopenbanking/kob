-- Phase 1: Payment Facilitation Database Schema

-- 1.1 Add Payment Facilitator Fields to Institutions Table
ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS use_kob_flutterwave BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS settlement_bank_account JSONB,
  ADD COLUMN IF NOT EXISTS settlement_frequency TEXT CHECK (settlement_frequency IN ('daily', 'weekly', 'monthly')) DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS minimum_settlement_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kob_payment_fee_structure_id UUID REFERENCES fee_structures(id);

COMMENT ON COLUMN institutions.use_kob_flutterwave IS 'Whether institution uses KOB Flutterwave account for payment processing';
COMMENT ON COLUMN institutions.settlement_bank_account IS 'Bank or mobile money account for settlements: {type: "bank"|"mobile_money", bank_code: string, account_number: string, account_name: string, phone_number: string, provider: string}';
COMMENT ON COLUMN institutions.settlement_frequency IS 'How often settlements are processed: daily, weekly, or monthly';
COMMENT ON COLUMN institutions.minimum_settlement_amount IS 'Minimum amount required before settlement is processed';

-- 1.2 Create Settlement Transactions Table
CREATE TABLE IF NOT EXISTS settlement_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) NOT NULL,
  settlement_ref TEXT UNIQUE NOT NULL,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Financial Summary
  total_inflows NUMERIC NOT NULL DEFAULT 0,
  total_outflows NUMERIC NOT NULL DEFAULT 0,
  kob_fees_charged NUMERIC NOT NULL DEFAULT 0,
  net_settlement_amount NUMERIC NOT NULL DEFAULT 0,
  
  -- Settlement Details
  settlement_method TEXT CHECK (settlement_method IN ('bank_transfer', 'mobile_money')) NOT NULL,
  settlement_destination JSONB NOT NULL,
  settlement_status TEXT CHECK (settlement_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  
  -- Tracking
  flutterwave_transfer_ref TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlement_institution ON settlement_transactions(institution_id, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_settlement_status ON settlement_transactions(settlement_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_settlement_ref ON settlement_transactions(settlement_ref);

COMMENT ON TABLE settlement_transactions IS 'Tracks settlement payouts to developers/fintechs using KOB Flutterwave facilitation';

-- Enable RLS
ALTER TABLE settlement_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for settlement_transactions
CREATE POLICY "Admins can view all settlements"
ON settlement_transactions FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Institutions can view own settlements"
ON settlement_transactions FOR SELECT
TO authenticated
USING (
  institution_id IN (
    SELECT id FROM institutions WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Only admins can manage settlements"
ON settlement_transactions FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 1.3 Extend Mobile Money Transactions for White-Label Tracking
ALTER TABLE mobile_money_transactions
  ADD COLUMN IF NOT EXISTS is_kob_facilitated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS facilitated_institution_id UUID REFERENCES institutions(id),
  ADD COLUMN IF NOT EXISTS kob_fee_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS settlement_id UUID REFERENCES settlement_transactions(id);

CREATE INDEX IF NOT EXISTS idx_mm_facilitated ON mobile_money_transactions(facilitated_institution_id, created_at DESC) WHERE is_kob_facilitated = TRUE;
CREATE INDEX IF NOT EXISTS idx_mm_settlement ON mobile_money_transactions(settlement_id) WHERE settlement_id IS NOT NULL;

COMMENT ON COLUMN mobile_money_transactions.is_kob_facilitated IS 'Whether transaction was processed through KOB Flutterwave account';
COMMENT ON COLUMN mobile_money_transactions.facilitated_institution_id IS 'Institution that used KOB facilitation service';
COMMENT ON COLUMN mobile_money_transactions.kob_fee_amount IS 'Fee charged by KOB for facilitation service';

-- 1.4 Extend Bank Transfer Transactions for White-Label Tracking
ALTER TABLE bank_transfer_transactions
  ADD COLUMN IF NOT EXISTS is_kob_facilitated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS facilitated_institution_id UUID REFERENCES institutions(id),
  ADD COLUMN IF NOT EXISTS kob_fee_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS settlement_id UUID REFERENCES settlement_transactions(id);

CREATE INDEX IF NOT EXISTS idx_bt_facilitated ON bank_transfer_transactions(facilitated_institution_id, created_at DESC) WHERE is_kob_facilitated = TRUE;
CREATE INDEX IF NOT EXISTS idx_bt_settlement ON bank_transfer_transactions(settlement_id) WHERE settlement_id IS NOT NULL;

COMMENT ON COLUMN bank_transfer_transactions.is_kob_facilitated IS 'Whether transaction was processed through KOB Flutterwave account';
COMMENT ON COLUMN bank_transfer_transactions.facilitated_institution_id IS 'Institution that used KOB facilitation service';
COMMENT ON COLUMN bank_transfer_transactions.kob_fee_amount IS 'Fee charged by KOB for facilitation service';

-- RLS Policies for facilitated transactions
CREATE POLICY "Institutions can view own facilitated mobile money transactions"
ON mobile_money_transactions FOR SELECT
TO authenticated
USING (
  is_kob_facilitated = TRUE AND
  facilitated_institution_id IN (
    SELECT id FROM institutions WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Institutions can view own facilitated bank transactions"
ON bank_transfer_transactions FOR SELECT
TO authenticated
USING (
  is_kob_facilitated = TRUE AND
  facilitated_institution_id IN (
    SELECT id FROM institutions WHERE user_id = auth.uid()
  )
);

-- 1.5 Settlement Calculation Function
CREATE OR REPLACE FUNCTION calculate_settlement_balance(
  _institution_id UUID,
  _period_start TIMESTAMP WITH TIME ZONE,
  _period_end TIMESTAMP WITH TIME ZONE
) RETURNS JSONB AS $$
DECLARE
  v_mm_inflows NUMERIC;
  v_mm_outflows NUMERIC;
  v_mm_fees NUMERIC;
  v_bt_inflows NUMERIC;
  v_bt_outflows NUMERIC;
  v_bt_fees NUMERIC;
  v_total_inflows NUMERIC;
  v_total_outflows NUMERIC;
  v_total_fees NUMERIC;
  v_net_amount NUMERIC;
  v_transaction_count INTEGER;
BEGIN
  -- Calculate Mobile Money inflows (charges/collections)
  SELECT 
    COALESCE(SUM(CASE WHEN transaction_type = 'charge' AND status = 'completed' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type = 'transfer' AND status = 'completed' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status = 'completed' THEN kob_fee_amount ELSE 0 END), 0),
    COUNT(*) FILTER (WHERE status = 'completed')
  INTO v_mm_inflows, v_mm_outflows, v_mm_fees, v_transaction_count
  FROM mobile_money_transactions
  WHERE facilitated_institution_id = _institution_id
    AND is_kob_facilitated = TRUE
    AND created_at BETWEEN _period_start AND _period_end
    AND settlement_id IS NULL;
  
  -- Calculate Bank Transfer inflows/outflows
  SELECT 
    COALESCE(SUM(CASE WHEN transaction_type = 'credit' AND status = 'completed' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type = 'debit' AND status = 'completed' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status = 'completed' THEN kob_fee_amount ELSE 0 END), 0)
  INTO v_bt_inflows, v_bt_outflows, v_bt_fees
  FROM bank_transfer_transactions
  WHERE facilitated_institution_id = _institution_id
    AND is_kob_facilitated = TRUE
    AND created_at BETWEEN _period_start AND _period_end
    AND settlement_id IS NULL;
  
  v_total_inflows := v_mm_inflows + v_bt_inflows;
  v_total_outflows := v_mm_outflows + v_bt_outflows;
  v_total_fees := v_mm_fees + v_bt_fees;
  v_net_amount := v_total_inflows - v_total_outflows - v_total_fees;
  
  RETURN jsonb_build_object(
    'total_inflows', v_total_inflows,
    'total_outflows', v_total_outflows,
    'total_kob_fees', v_total_fees,
    'net_settlement_amount', v_net_amount,
    'transaction_count', v_transaction_count,
    'breakdown', jsonb_build_object(
      'mobile_money_inflows', v_mm_inflows,
      'mobile_money_outflows', v_mm_outflows,
      'mobile_money_fees', v_mm_fees,
      'bank_transfer_inflows', v_bt_inflows,
      'bank_transfer_outflows', v_bt_outflows,
      'bank_transfer_fees', v_bt_fees
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION calculate_settlement_balance IS 'Calculates net settlement amount for facilitated institutions';

-- 1.6 Trigger for settlement_transactions updated_at
CREATE OR REPLACE FUNCTION update_settlement_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER settlement_transactions_updated_at
BEFORE UPDATE ON settlement_transactions
FOR EACH ROW
EXECUTE FUNCTION update_settlement_updated_at();