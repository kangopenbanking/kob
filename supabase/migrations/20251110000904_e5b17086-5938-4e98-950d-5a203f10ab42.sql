-- Drop table if exists to start fresh
DROP TABLE IF EXISTS system_alerts CASCADE;

-- Create system_alerts table for health monitoring
CREATE TABLE system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  status TEXT NOT NULL DEFAULT 'active',
  acknowledged_by UUID,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add constraints after table creation
ALTER TABLE system_alerts ADD CONSTRAINT system_alerts_severity_check 
  CHECK (severity IN ('info', 'medium', 'high', 'critical'));
  
ALTER TABLE system_alerts ADD CONSTRAINT system_alerts_status_check 
  CHECK (status IN ('active', 'acknowledged', 'resolved'));

-- Add foreign key
ALTER TABLE system_alerts ADD CONSTRAINT system_alerts_acknowledged_by_fkey 
  FOREIGN KEY (acknowledged_by) REFERENCES auth.users(id);

-- Enable RLS
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;

-- Admins can view all alerts
CREATE POLICY "Admins can view all system alerts"
ON system_alerts FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_id = auth.uid() 
  AND role = 'admin'
));

-- Admins can manage alerts
CREATE POLICY "Admins can manage system alerts"
ON system_alerts FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_id = auth.uid() 
  AND role = 'admin'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_id = auth.uid() 
  AND role = 'admin'
));

-- Create indexes
CREATE INDEX idx_system_alerts_status ON system_alerts(status, created_at DESC);
CREATE INDEX idx_system_alerts_severity ON system_alerts(severity, created_at DESC);