-- Phase 1: Fee Management System - Complete Database Schema (Fixed Order)

-- ============================================
-- TABLES (Proper Dependency Order)
-- ============================================

-- Create sequence for invoice numbers first
CREATE SEQUENCE IF NOT EXISTS invoice_sequence START 1;

-- Table: fee_structures (no dependencies)
CREATE TABLE fee_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('transfer', 'payment', 'bill_payment', 'mobile_money_transfer', 'mobile_money_charge')),
  fee_model TEXT NOT NULL CHECK (fee_model IN ('fixed', 'percentage', 'hybrid', 'tiered')),
  
  -- Fixed fee (XAF)
  fixed_amount NUMERIC(15,2) DEFAULT 0,
  
  -- Percentage fee (0-100)
  percentage_rate NUMERIC(5,4) DEFAULT 0,
  
  -- Min/max caps for percentage fees
  min_fee_amount NUMERIC(15,2) DEFAULT 0,
  max_fee_amount NUMERIC(15,2),
  
  -- Tiered pricing (JSON array)
  tiered_rates JSONB,
  
  -- Effective dates
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  
  UNIQUE(institution_id, transaction_type, effective_from)
);

CREATE INDEX idx_fee_structures_institution ON fee_structures(institution_id);
CREATE INDEX idx_fee_structures_active ON fee_structures(is_active, effective_from, effective_until);

-- Table: fee_waivers (create before transaction_fees)
CREATE TABLE fee_waivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  institution_id UUID REFERENCES institutions(id) NOT NULL,
  
  -- Waiver details
  waiver_type TEXT NOT NULL CHECK (waiver_type IN ('percentage_discount', 'fixed_discount', 'full_waiver', 'promotional')),
  discount_percentage NUMERIC(5,2),
  discount_fixed_amount NUMERIC(15,2),
  
  -- Applicability
  applies_to_transaction_types TEXT[],
  
  -- Effective period
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE NOT NULL,
  
  -- Usage limits
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  
  -- Reason
  reason TEXT NOT NULL,
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_fee_waivers_institution ON fee_waivers(institution_id);
CREATE INDEX idx_fee_waivers_active ON fee_waivers(is_active, effective_from, effective_until);

-- Table: institution_invoices (create before transaction_fees)
CREATE TABLE institution_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  
  institution_id UUID REFERENCES institutions(id) NOT NULL,
  
  -- Billing period
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'quarterly', 'on_demand')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Amounts
  total_transactions INTEGER NOT NULL DEFAULT 0,
  subtotal_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_waivers NUMERIC(15,2) DEFAULT 0,
  tax_amount NUMERIC(15,2) DEFAULT 0,
  total_amount NUMERIC(15,2) NOT NULL,
  currency TEXT DEFAULT 'XAF',
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'sent', 'paid', 'overdue', 'cancelled')),
  
  -- Payment tracking
  due_date DATE NOT NULL,
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,
  payment_method TEXT,
  
  -- File storage
  pdf_url TEXT,
  
  -- Notes
  notes TEXT,
  admin_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_invoices_institution ON institution_invoices(institution_id, period_end);
CREATE INDEX idx_invoices_status ON institution_invoices(status);
CREATE INDEX idx_invoices_due_date ON institution_invoices(due_date) WHERE status IN ('pending', 'sent');

-- Table: transaction_fees (depends on fee_structures, fee_waivers, institution_invoices)
CREATE TABLE transaction_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Transaction reference
  transaction_id UUID,
  transaction_type TEXT NOT NULL,
  transaction_ref TEXT NOT NULL,
  transaction_amount NUMERIC(15,2) NOT NULL,
  transaction_currency TEXT DEFAULT 'XAF',
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Institution
  institution_id UUID REFERENCES institutions(id) NOT NULL,
  
  -- Fee calculation
  fee_structure_id UUID REFERENCES fee_structures(id),
  fee_model TEXT NOT NULL,
  calculated_fee NUMERIC(15,2) NOT NULL,
  
  -- Fee breakdown (for transparency)
  fee_breakdown JSONB,
  
  -- Waiver applied
  waiver_id UUID REFERENCES fee_waivers(id),
  waived_amount NUMERIC(15,2) DEFAULT 0,
  final_fee NUMERIC(15,2) NOT NULL,
  
  -- Billing
  invoice_id UUID REFERENCES institution_invoices(id),
  billing_status TEXT DEFAULT 'pending' CHECK (billing_status IN ('pending', 'invoiced', 'paid', 'waived', 'disputed')),
  billed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transaction_fees_institution ON transaction_fees(institution_id, transaction_date);
CREATE INDEX idx_transaction_fees_invoice ON transaction_fees(invoice_id);
CREATE INDEX idx_transaction_fees_billing_status ON transaction_fees(billing_status);
CREATE INDEX idx_transaction_fees_ref ON transaction_fees(transaction_ref);

-- ============================================
-- DATABASE FUNCTIONS
-- ============================================

-- Function: calculate_transaction_fee
CREATE OR REPLACE FUNCTION calculate_transaction_fee(
  _institution_id UUID,
  _transaction_type TEXT,
  _transaction_amount NUMERIC,
  _transaction_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee_structure RECORD;
  v_calculated_fee NUMERIC := 0;
  v_fixed_component NUMERIC := 0;
  v_percentage_component NUMERIC := 0;
  v_tier JSONB;
  v_waiver RECORD;
  v_waived_amount NUMERIC := 0;
  v_final_fee NUMERIC := 0;
  v_breakdown JSONB;
BEGIN
  -- Get active fee structure
  SELECT * INTO v_fee_structure
  FROM fee_structures
  WHERE institution_id = _institution_id
    AND transaction_type = _transaction_type
    AND is_active = true
    AND effective_from <= _transaction_date
    AND (effective_until IS NULL OR effective_until >= _transaction_date)
  ORDER BY effective_from DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No fee structure found for institution % and transaction type %', 
      _institution_id, _transaction_type;
  END IF;
  
  -- Calculate based on fee model
  CASE v_fee_structure.fee_model
    WHEN 'fixed' THEN
      v_calculated_fee := v_fee_structure.fixed_amount;
      v_fixed_component := v_calculated_fee;
    
    WHEN 'percentage' THEN
      v_percentage_component := (_transaction_amount * v_fee_structure.percentage_rate / 100);
      
      IF v_fee_structure.min_fee_amount IS NOT NULL AND v_percentage_component < v_fee_structure.min_fee_amount THEN
        v_percentage_component := v_fee_structure.min_fee_amount;
      END IF;
      
      IF v_fee_structure.max_fee_amount IS NOT NULL AND v_percentage_component > v_fee_structure.max_fee_amount THEN
        v_percentage_component := v_fee_structure.max_fee_amount;
      END IF;
      
      v_calculated_fee := v_percentage_component;
    
    WHEN 'hybrid' THEN
      v_fixed_component := v_fee_structure.fixed_amount;
      v_percentage_component := (_transaction_amount * v_fee_structure.percentage_rate / 100);
      
      IF v_fee_structure.min_fee_amount IS NOT NULL AND (v_fixed_component + v_percentage_component) < v_fee_structure.min_fee_amount THEN
        v_percentage_component := v_fee_structure.min_fee_amount - v_fixed_component;
      END IF;
      
      IF v_fee_structure.max_fee_amount IS NOT NULL AND (v_fixed_component + v_percentage_component) > v_fee_structure.max_fee_amount THEN
        v_percentage_component := v_fee_structure.max_fee_amount - v_fixed_component;
      END IF;
      
      v_calculated_fee := v_fixed_component + v_percentage_component;
    
    WHEN 'tiered' THEN
      FOR v_tier IN SELECT * FROM jsonb_array_elements(v_fee_structure.tiered_rates)
      LOOP
        IF _transaction_amount >= (v_tier->>'min')::NUMERIC AND 
           (_transaction_amount < (v_tier->>'max')::NUMERIC OR (v_tier->>'max') IS NULL) THEN
          
          v_fixed_component := COALESCE((v_tier->>'fixed')::NUMERIC, 0);
          v_percentage_component := COALESCE(_transaction_amount * (v_tier->>'percentage')::NUMERIC / 100, 0);
          v_calculated_fee := v_fixed_component + v_percentage_component;
          EXIT;
        END IF;
      END LOOP;
  END CASE;
  
  -- Check for applicable waivers
  SELECT * INTO v_waiver
  FROM fee_waivers
  WHERE institution_id = _institution_id
    AND is_active = true
    AND effective_from <= _transaction_date
    AND effective_until >= _transaction_date
    AND (max_uses IS NULL OR current_uses < max_uses)
    AND (applies_to_transaction_types IS NULL OR _transaction_type = ANY(applies_to_transaction_types))
  ORDER BY effective_from DESC
  LIMIT 1;
  
  IF FOUND THEN
    CASE v_waiver.waiver_type
      WHEN 'percentage_discount' THEN
        v_waived_amount := v_calculated_fee * v_waiver.discount_percentage / 100;
      WHEN 'fixed_discount' THEN
        v_waived_amount := LEAST(v_waiver.discount_fixed_amount, v_calculated_fee);
      WHEN 'full_waiver' THEN
        v_waived_amount := v_calculated_fee;
      WHEN 'promotional' THEN
        v_waived_amount := v_calculated_fee * v_waiver.discount_percentage / 100;
    END CASE;
    
    UPDATE fee_waivers
    SET current_uses = current_uses + 1
    WHERE id = v_waiver.id;
  END IF;
  
  v_final_fee := GREATEST(v_calculated_fee - v_waived_amount, 0);
  
  v_breakdown := jsonb_build_object(
    'fee_structure_id', v_fee_structure.id,
    'fee_model', v_fee_structure.fee_model,
    'transaction_amount', _transaction_amount,
    'fixed_component', v_fixed_component,
    'percentage_component', v_percentage_component,
    'percentage_rate', v_fee_structure.percentage_rate,
    'calculated_fee', v_calculated_fee,
    'waiver_id', v_waiver.id,
    'waiver_type', v_waiver.waiver_type,
    'waived_amount', v_waived_amount,
    'final_fee', v_final_fee
  );
  
  RETURN v_breakdown;
END;
$$;

-- Function: record_transaction_fee
CREATE OR REPLACE FUNCTION record_transaction_fee(
  _institution_id UUID,
  _transaction_type TEXT,
  _transaction_ref TEXT,
  _transaction_amount NUMERIC,
  _transaction_id UUID DEFAULT NULL,
  _metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee_calculation JSONB;
  v_fee_id UUID;
BEGIN
  v_fee_calculation := calculate_transaction_fee(
    _institution_id,
    _transaction_type,
    _transaction_amount,
    CURRENT_DATE
  );
  
  INSERT INTO transaction_fees (
    institution_id,
    transaction_type,
    transaction_ref,
    transaction_id,
    transaction_amount,
    transaction_date,
    fee_structure_id,
    fee_model,
    calculated_fee,
    waiver_id,
    waived_amount,
    final_fee,
    fee_breakdown,
    metadata
  ) VALUES (
    _institution_id,
    _transaction_type,
    _transaction_ref,
    _transaction_id,
    _transaction_amount,
    NOW(),
    (v_fee_calculation->>'fee_structure_id')::UUID,
    v_fee_calculation->>'fee_model',
    (v_fee_calculation->>'calculated_fee')::NUMERIC,
    (v_fee_calculation->>'waiver_id')::UUID,
    (v_fee_calculation->>'waived_amount')::NUMERIC,
    (v_fee_calculation->>'final_fee')::NUMERIC,
    v_fee_calculation,
    _metadata
  ) RETURNING id INTO v_fee_id;
  
  RETURN v_fee_id;
END;
$$;

-- Function: generate_institution_invoice
CREATE OR REPLACE FUNCTION generate_institution_invoice(
  _institution_id UUID,
  _billing_cycle TEXT,
  _period_start DATE,
  _period_end DATE,
  _admin_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id UUID;
  v_invoice_number TEXT;
  v_total_transactions INTEGER;
  v_subtotal NUMERIC;
  v_total_waivers NUMERIC;
  v_total_amount NUMERIC;
  v_due_date DATE;
BEGIN
  v_invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYY-MM') || '-' || 
                      LPAD(NEXTVAL('invoice_sequence')::TEXT, 6, '0');
  
  SELECT 
    COUNT(*),
    COALESCE(SUM(calculated_fee), 0),
    COALESCE(SUM(waived_amount), 0),
    COALESCE(SUM(final_fee), 0)
  INTO 
    v_total_transactions,
    v_subtotal,
    v_total_waivers,
    v_total_amount
  FROM transaction_fees
  WHERE institution_id = _institution_id
    AND transaction_date >= _period_start
    AND transaction_date <= _period_end
    AND billing_status = 'pending';
  
  v_due_date := _period_end + INTERVAL '30 days';
  
  INSERT INTO institution_invoices (
    invoice_number,
    institution_id,
    billing_cycle,
    period_start,
    period_end,
    total_transactions,
    subtotal_amount,
    total_waivers,
    total_amount,
    due_date,
    status,
    created_by
  ) VALUES (
    v_invoice_number,
    _institution_id,
    _billing_cycle,
    _period_start,
    _period_end,
    v_total_transactions,
    v_subtotal,
    v_total_waivers,
    v_total_amount,
    v_due_date,
    'pending',
    _admin_id
  ) RETURNING id INTO v_invoice_id;
  
  UPDATE transaction_fees
  SET 
    invoice_id = v_invoice_id,
    billing_status = 'invoiced',
    billed_at = NOW()
  WHERE institution_id = _institution_id
    AND transaction_date >= _period_start
    AND transaction_date <= _period_end
    AND billing_status = 'pending';
  
  RETURN v_invoice_id;
END;
$$;

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all fee structures"
ON fee_structures FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Institutions can view own fee structures"
ON fee_structures FOR SELECT
TO authenticated
USING (institution_id IN (
  SELECT id FROM institutions WHERE user_id = auth.uid()
));

ALTER TABLE transaction_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all transaction fees"
ON transaction_fees FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Institutions can view own transaction fees"
ON transaction_fees FOR SELECT
TO authenticated
USING (institution_id IN (
  SELECT id FROM institutions WHERE user_id = auth.uid()
));

ALTER TABLE institution_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all invoices"
ON institution_invoices FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Institutions can view own invoices"
ON institution_invoices FOR SELECT
TO authenticated
USING (institution_id IN (
  SELECT id FROM institutions WHERE user_id = auth.uid()
));

ALTER TABLE fee_waivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage fee waivers"
ON fee_waivers FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Institutions can view own waivers"
ON fee_waivers FOR SELECT
TO authenticated
USING (institution_id IN (
  SELECT id FROM institutions WHERE user_id = auth.uid()
));

-- ============================================
-- REPORTING VIEWS
-- ============================================

CREATE OR REPLACE VIEW daily_fee_summary AS
SELECT 
  tf.institution_id,
  i.institution_name,
  DATE(tf.transaction_date) as fee_date,
  tf.transaction_type,
  COUNT(*) as transaction_count,
  SUM(tf.transaction_amount) as total_transaction_volume,
  SUM(tf.calculated_fee) as total_calculated_fees,
  SUM(tf.waived_amount) as total_waivers,
  SUM(tf.final_fee) as total_final_fees,
  AVG(tf.final_fee) as average_fee_per_transaction
FROM transaction_fees tf
JOIN institutions i ON tf.institution_id = i.id
GROUP BY tf.institution_id, i.institution_name, DATE(tf.transaction_date), tf.transaction_type
ORDER BY fee_date DESC, institution_name;

GRANT SELECT ON daily_fee_summary TO authenticated;