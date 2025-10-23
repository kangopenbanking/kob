-- KYC/AML Verification System
CREATE TABLE kyc_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  verification_type TEXT NOT NULL, -- 'identity', 'address', 'source_of_funds'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_review', 'approved', 'rejected', 'expired'
  risk_level TEXT, -- 'low', 'medium', 'high'
  document_type TEXT, -- 'passport', 'national_id', 'drivers_license', 'utility_bill', 'bank_statement'
  document_number TEXT,
  document_country TEXT,
  document_expiry_date DATE,
  document_front_url TEXT,
  document_back_url TEXT,
  selfie_url TEXT,
  verification_method TEXT, -- 'manual', 'automated', 'third_party'
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  expiry_date TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer Due Diligence (CDD)
CREATE TABLE customer_due_diligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  risk_category TEXT NOT NULL DEFAULT 'standard', -- 'standard', 'enhanced', 'simplified'
  occupation TEXT,
  source_of_income TEXT,
  estimated_annual_income NUMERIC,
  purpose_of_account TEXT,
  expected_transaction_volume NUMERIC,
  pep_status BOOLEAN DEFAULT FALSE, -- Politically Exposed Person
  pep_details JSONB,
  beneficial_owners JSONB, -- Array of beneficial owner details
  business_nature TEXT,
  country_of_residence TEXT,
  tax_residency TEXT[],
  tin TEXT, -- Tax Identification Number
  sanctions_screening_status TEXT DEFAULT 'pending',
  last_screening_date TIMESTAMPTZ,
  next_review_date DATE,
  risk_score INTEGER, -- 0-100
  risk_factors JSONB,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sanctions Screening
CREATE TABLE sanctions_screening (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  entity_type TEXT NOT NULL, -- 'customer', 'beneficiary', 'counterparty'
  entity_name TEXT NOT NULL,
  entity_data JSONB NOT NULL,
  screening_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'clear', 'potential_match', 'confirmed_match'
  matches JSONB, -- Array of potential matches
  screening_provider TEXT, -- 'internal', 'worldcheck', 'dowjones', 'ofac'
  screened_lists TEXT[], -- ['OFAC', 'UN', 'EU', 'UKFT']
  match_score NUMERIC,
  false_positive BOOLEAN DEFAULT FALSE,
  resolution_notes TEXT,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  next_screening_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Strong Customer Authentication (SCA)
CREATE TABLE sca_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  challenge_type TEXT NOT NULL, -- 'otp_sms', 'otp_email', 'biometric', 'security_question'
  operation_type TEXT NOT NULL, -- 'payment', 'consent', 'account_change', 'high_value_transaction'
  operation_id UUID,
  challenge_code TEXT,
  challenge_data JSONB,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'verified', 'failed', 'expired'
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,
  device_fingerprint TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transaction Monitoring & AML
CREATE TABLE transaction_monitoring_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID,
  user_id UUID REFERENCES auth.users(id),
  alert_type TEXT NOT NULL, -- 'velocity', 'amount_threshold', 'pattern_anomaly', 'geo_location', 'sanctions_match'
  severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
  rule_id TEXT,
  rule_name TEXT,
  alert_description TEXT,
  transaction_details JSONB,
  risk_indicators JSONB,
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'investigating', 'false_positive', 'sar_filed', 'closed'
  assigned_to UUID REFERENCES auth.users(id),
  investigation_notes TEXT,
  resolution TEXT,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  escalated_to TEXT, -- 'mlro', 'compliance_officer', 'regulator'
  sar_filed BOOLEAN DEFAULT FALSE, -- Suspicious Activity Report
  sar_reference TEXT,
  sar_filed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Data Privacy & GDPR
CREATE TABLE data_privacy_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  request_type TEXT NOT NULL, -- 'data_export', 'data_deletion', 'data_rectification', 'data_portability', 'consent_withdrawal'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'rejected'
  request_details JSONB,
  data_categories TEXT[], -- ['transactions', 'personal_info', 'consents', 'communications']
  export_format TEXT, -- 'json', 'csv', 'pdf'
  export_url TEXT,
  completion_deadline DATE,
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Regulatory Reports
CREATE TABLE regulatory_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL, -- 'sar', 'ctr', 'iftr', 'kyc_summary', 'transaction_report'
  report_period_start DATE NOT NULL,
  report_period_end DATE NOT NULL,
  regulator TEXT NOT NULL, -- 'cobac', 'beac', 'fincen', 'fca'
  report_format TEXT NOT NULL, -- 'xml', 'json', 'csv', 'pdf'
  report_data JSONB,
  report_file_url TEXT,
  submission_status TEXT DEFAULT 'draft', -- 'draft', 'pending_review', 'submitted', 'accepted', 'rejected'
  submission_reference TEXT,
  submitted_by UUID REFERENCES auth.users(id),
  submitted_at TIMESTAMPTZ,
  acknowledgment_received BOOLEAN DEFAULT FALSE,
  acknowledgment_date TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compliance Training & Certifications
CREATE TABLE compliance_training (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  training_type TEXT NOT NULL, -- 'aml', 'kyc', 'data_privacy', 'sanctions', 'fraud_prevention'
  training_title TEXT NOT NULL,
  training_description TEXT,
  required_for_role TEXT[],
  completion_status TEXT DEFAULT 'not_started', -- 'not_started', 'in_progress', 'completed', 'expired'
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expiry_date DATE,
  score INTEGER,
  passing_score INTEGER DEFAULT 80,
  certificate_url TEXT,
  renewal_required BOOLEAN DEFAULT TRUE,
  renewal_period_months INTEGER DEFAULT 12,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE kyc_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_due_diligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE sanctions_screening ENABLE ROW LEVEL SECURITY;
ALTER TABLE sca_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_monitoring_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_privacy_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_training ENABLE ROW LEVEL SECURITY;

-- KYC Verifications Policies
CREATE POLICY "Users can view own KYC verifications"
  ON kyc_verifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own KYC verifications"
  ON kyc_verifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all KYC verifications"
  ON kyc_verifications FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- CDD Policies
CREATE POLICY "Users can view own CDD records"
  ON customer_due_diligence FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all CDD records"
  ON customer_due_diligence FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Sanctions Screening Policies
CREATE POLICY "Admins can manage sanctions screening"
  ON sanctions_screening FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- SCA Challenges Policies
CREATE POLICY "Users can view own SCA challenges"
  ON sca_challenges FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own SCA challenges"
  ON sca_challenges FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can create SCA challenges"
  ON sca_challenges FOR INSERT
  WITH CHECK (true);

-- Transaction Monitoring Policies
CREATE POLICY "Admins can manage transaction alerts"
  ON transaction_monitoring_alerts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Data Privacy Policies
CREATE POLICY "Users can manage own privacy requests"
  ON data_privacy_requests FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all privacy requests"
  ON data_privacy_requests FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Regulatory Reports Policies
CREATE POLICY "Admins can manage regulatory reports"
  ON regulatory_reports FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Compliance Training Policies
CREATE POLICY "Users can view own training records"
  ON compliance_training FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own training progress"
  ON compliance_training FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all training records"
  ON compliance_training FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_kyc_verifications_updated_at
  BEFORE UPDATE ON kyc_verifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_due_diligence_updated_at
  BEFORE UPDATE ON customer_due_diligence
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sanctions_screening_updated_at
  BEFORE UPDATE ON sanctions_screening
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transaction_monitoring_alerts_updated_at
  BEFORE UPDATE ON transaction_monitoring_alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_privacy_requests_updated_at
  BEFORE UPDATE ON data_privacy_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_regulatory_reports_updated_at
  BEFORE UPDATE ON regulatory_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compliance_training_updated_at
  BEFORE UPDATE ON compliance_training
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Database Functions for Compliance

-- Calculate KYC Risk Score
CREATE OR REPLACE FUNCTION calculate_kyc_risk_score(
  _user_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_risk_score INTEGER := 0;
  v_kyc_status TEXT;
  v_cdd RECORD;
BEGIN
  -- Check KYC verification status
  SELECT status INTO v_kyc_status
  FROM kyc_verifications
  WHERE user_id = _user_id
    AND verification_type = 'identity'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_kyc_status IS NULL THEN
    v_risk_score := v_risk_score + 50; -- No KYC
  ELSIF v_kyc_status = 'rejected' THEN
    v_risk_score := v_risk_score + 40;
  ELSIF v_kyc_status = 'pending' THEN
    v_risk_score := v_risk_score + 30;
  END IF;
  
  -- Check CDD factors
  SELECT * INTO v_cdd
  FROM customer_due_diligence
  WHERE user_id = _user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_cdd IS NOT NULL THEN
    IF v_cdd.pep_status THEN
      v_risk_score := v_risk_score + 30;
    END IF;
    
    IF v_cdd.risk_category = 'enhanced' THEN
      v_risk_score := v_risk_score + 20;
    END IF;
  END IF;
  
  -- Check sanctions screening
  IF EXISTS (
    SELECT 1 FROM sanctions_screening
    WHERE user_id = _user_id
      AND screening_status IN ('potential_match', 'confirmed_match')
  ) THEN
    v_risk_score := v_risk_score + 50;
  END IF;
  
  -- Cap at 100
  RETURN LEAST(v_risk_score, 100);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;