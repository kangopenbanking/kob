-- Credit Scores Table
CREATE TABLE IF NOT EXISTS credit_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 300 AND score <= 850),
  score_version TEXT DEFAULT 'v1.0',
  scoring_model TEXT NOT NULL,
  score_factors JSONB NOT NULL,
  confidence_level NUMERIC(3,2),
  
  payment_history_score INTEGER,
  amounts_owed_score INTEGER,
  credit_history_length_score INTEGER,
  credit_mix_score INTEGER,
  new_credit_score INTEGER,
  
  savings_behavior_score INTEGER,
  transaction_pattern_score INTEGER,
  kyc_compliance_score INTEGER,
  
  external_bureau_score INTEGER,
  external_bureau_name TEXT,
  external_score_fetched_at TIMESTAMPTZ,
  
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  next_update_date DATE,
  status TEXT DEFAULT 'active',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit Reports Table
CREATE TABLE IF NOT EXISTS credit_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  report_type TEXT NOT NULL,
  credit_score_id UUID REFERENCES credit_scores(id),
  
  personal_info_verified BOOLEAN DEFAULT FALSE,
  employment_verified BOOLEAN DEFAULT FALSE,
  income_verified BOOLEAN DEFAULT FALSE,
  
  total_accounts INTEGER DEFAULT 0,
  active_accounts INTEGER DEFAULT 0,
  closed_accounts INTEGER DEFAULT 0,
  total_credit_limit NUMERIC(15,2),
  total_balance NUMERIC(15,2),
  credit_utilization_ratio NUMERIC(5,2),
  
  total_loans INTEGER DEFAULT 0,
  active_loans INTEGER DEFAULT 0,
  completed_loans INTEGER DEFAULT 0,
  defaulted_loans INTEGER DEFAULT 0,
  total_borrowed NUMERIC(15,2),
  total_repaid NUMERIC(15,2),
  on_time_payment_rate NUMERIC(5,2),
  
  total_savings_accounts INTEGER DEFAULT 0,
  total_savings_balance NUMERIC(15,2),
  average_monthly_savings NUMERIC(15,2),
  savings_consistency_score INTEGER,
  
  late_payments_30_days INTEGER DEFAULT 0,
  late_payments_60_days INTEGER DEFAULT 0,
  late_payments_90_days INTEGER DEFAULT 0,
  missed_payments INTEGER DEFAULT 0,
  total_payments_made INTEGER DEFAULT 0,
  
  hard_inquiries_6m INTEGER DEFAULT 0,
  hard_inquiries_12m INTEGER DEFAULT 0,
  soft_inquiries_total INTEGER DEFAULT 0,
  
  collections INTEGER DEFAULT 0,
  bankruptcies INTEGER DEFAULT 0,
  liens INTEGER DEFAULT 0,
  judgments INTEGER DEFAULT 0,
  
  external_report_data JSONB,
  external_report_fetched_at TIMESTAMPTZ,
  
  generated_by UUID,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  requested_by TEXT,
  requester_id UUID,
  purpose TEXT,
  
  report_file_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit Inquiries Table
CREATE TABLE IF NOT EXISTS credit_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  inquiry_type TEXT NOT NULL,
  inquirer_type TEXT NOT NULL,
  inquirer_name TEXT NOT NULL,
  inquirer_id UUID,
  
  purpose TEXT NOT NULL,
  inquiry_date TIMESTAMPTZ DEFAULT NOW(),
  
  user_consent_given BOOLEAN DEFAULT FALSE,
  consent_reference UUID,
  
  score_provided INTEGER,
  report_provided BOOLEAN DEFAULT FALSE,
  report_id UUID REFERENCES credit_reports(id),
  
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit Score History Table
CREATE TABLE IF NOT EXISTS credit_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  credit_score_id UUID REFERENCES credit_scores(id),
  
  score INTEGER NOT NULL,
  score_change INTEGER,
  change_reason TEXT,
  significant_events JSONB,
  
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit Monitoring Alerts Table
CREATE TABLE IF NOT EXISTS credit_monitoring_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  
  title TEXT NOT NULL,
  description TEXT,
  alert_data JSONB,
  
  status TEXT DEFAULT 'unread',
  read_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API Clients Table for B2B Access
CREATE TABLE IF NOT EXISTS credit_api_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id),
  
  client_name TEXT NOT NULL,
  client_type TEXT NOT NULL,
  
  api_key TEXT UNIQUE NOT NULL,
  api_secret_hash TEXT NOT NULL,
  
  is_active BOOLEAN DEFAULT TRUE,
  is_sandbox BOOLEAN DEFAULT FALSE,
  
  allowed_operations TEXT[],
  rate_limit_per_minute INTEGER DEFAULT 60,
  rate_limit_per_day INTEGER DEFAULT 10000,
  
  pricing_tier TEXT DEFAULT 'standard',
  cost_per_query NUMERIC(10,2),
  
  total_queries INTEGER DEFAULT 0,
  last_query_at TIMESTAMPTZ,
  
  data_retention_days INTEGER DEFAULT 90,
  audit_logging_enabled BOOLEAN DEFAULT TRUE,
  
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- API Usage Logs Table
CREATE TABLE IF NOT EXISTS credit_api_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES credit_api_clients(id),
  
  operation_type TEXT NOT NULL,
  user_id UUID,
  
  request_payload JSONB,
  response_status INTEGER,
  response_time_ms INTEGER,
  
  score_returned INTEGER,
  report_id UUID REFERENCES credit_reports(id),
  
  ip_address INET,
  user_agent TEXT,
  
  billed_amount NUMERIC(10,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- External Credit Data Cache Table
CREATE TABLE IF NOT EXISTS external_credit_data_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  bureau_name TEXT NOT NULL,
  data_type TEXT NOT NULL,
  
  raw_data JSONB NOT NULL,
  parsed_data JSONB,
  
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  
  is_stale BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_credit_scores_user_id ON credit_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_scores_status ON credit_scores(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_credit_scores_calculated_at ON credit_scores(calculated_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_reports_user_id ON credit_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_reports_generated_at ON credit_reports(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_reports_requester ON credit_reports(requester_id);

CREATE INDEX IF NOT EXISTS idx_credit_inquiries_user_id ON credit_inquiries(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_inquiries_date ON credit_inquiries(inquiry_date DESC);
CREATE INDEX IF NOT EXISTS idx_credit_inquiries_type ON credit_inquiries(inquiry_type);

CREATE INDEX IF NOT EXISTS idx_credit_api_clients_api_key ON credit_api_clients(api_key) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_credit_api_clients_institution ON credit_api_clients(institution_id);

CREATE INDEX IF NOT EXISTS idx_credit_api_usage_client_created ON credit_api_usage_logs(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_api_usage_user ON credit_api_usage_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_credit_score_history_user ON credit_score_history(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_monitoring_alerts_user ON credit_monitoring_alerts(user_id, created_at DESC);

-- RLS Policies for credit_scores
ALTER TABLE credit_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit scores"
  ON credit_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can create credit scores"
  ON credit_scores FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update credit scores"
  ON credit_scores FOR UPDATE
  USING (true);

CREATE POLICY "Admins can manage all credit scores"
  ON credit_scores FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for credit_reports
ALTER TABLE credit_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit reports"
  ON credit_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can create credit reports"
  ON credit_reports FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all reports"
  ON credit_reports FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for credit_inquiries
ALTER TABLE credit_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view inquiries about them"
  ON credit_inquiries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can create inquiries"
  ON credit_inquiries FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all inquiries"
  ON credit_inquiries FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for credit_score_history
ALTER TABLE credit_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own history"
  ON credit_score_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can create history"
  ON credit_score_history FOR INSERT
  WITH CHECK (true);

-- RLS Policies for credit_monitoring_alerts
ALTER TABLE credit_monitoring_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alerts"
  ON credit_monitoring_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts"
  ON credit_monitoring_alerts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can create alerts"
  ON credit_monitoring_alerts FOR INSERT
  WITH CHECK (true);

-- RLS Policies for credit_api_clients
ALTER TABLE credit_api_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage API clients"
  ON credit_api_clients FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for credit_api_usage_logs
ALTER TABLE credit_api_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all API usage"
  ON credit_api_usage_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can create usage logs"
  ON credit_api_usage_logs FOR INSERT
  WITH CHECK (true);

-- RLS Policies for external_credit_data_cache
ALTER TABLE external_credit_data_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can manage cache"
  ON external_credit_data_cache FOR ALL
  USING (true);

-- View for credit score distribution
CREATE OR REPLACE VIEW credit_score_distribution AS
SELECT 
  CASE 
    WHEN score >= 800 THEN 'Excellent (800-850)'
    WHEN score >= 740 THEN 'Very Good (740-799)'
    WHEN score >= 670 THEN 'Good (670-739)'
    WHEN score >= 580 THEN 'Fair (580-669)'
    ELSE 'Poor (300-579)'
  END as score_range,
  COUNT(*) as user_count,
  ROUND(AVG(score)) as avg_score
FROM credit_scores
WHERE status = 'active'
  AND calculated_at > NOW() - INTERVAL '30 days'
GROUP BY score_range
ORDER BY avg_score DESC;

-- Add credit score columns to loan_applications
ALTER TABLE loan_applications 
ADD COLUMN IF NOT EXISTS credit_score INTEGER,
ADD COLUMN IF NOT EXISTS credit_report_id UUID REFERENCES credit_reports(id),
ADD COLUMN IF NOT EXISTS auto_decision TEXT,
ADD COLUMN IF NOT EXISTS recommended_amount NUMERIC(15,2);