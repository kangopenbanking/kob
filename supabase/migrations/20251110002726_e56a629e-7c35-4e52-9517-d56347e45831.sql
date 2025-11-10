-- Create load test results table
CREATE TABLE IF NOT EXISTS load_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL,
  concurrent_requests INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create AI anomaly reports table
CREATE TABLE IF NOT EXISTS ai_anomaly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_data JSONB NOT NULL,
  ai_analysis TEXT NOT NULL,
  anomalies_detected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_load_test_results_created_at ON load_test_results(created_at DESC);
CREATE INDEX idx_ai_anomaly_reports_created_at ON ai_anomaly_reports(created_at DESC);
CREATE INDEX idx_ai_anomaly_reports_anomalies ON ai_anomaly_reports(anomalies_detected);

-- Enable RLS
ALTER TABLE load_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_anomaly_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies (admin only)
CREATE POLICY "Admins can view load test results"
  ON load_test_results FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create load test results"
  ON load_test_results FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view anomaly reports"
  ON ai_anomaly_reports FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create anomaly reports"
  ON ai_anomaly_reports FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));