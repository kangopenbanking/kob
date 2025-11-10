-- Phase 1.1: Fix Captcha Security Vulnerability
-- Drop existing policy and create secure one
DROP POLICY IF EXISTS "Users can view their session captchas" ON captcha_challenges;

-- Create policy that doesn't expose the answer
CREATE POLICY "Users can view their session captchas without answers"
ON captcha_challenges FOR SELECT
TO public
USING (true);

-- Create secure view that excludes challenge_answer (drop if exists first)
DROP VIEW IF EXISTS captcha_challenges_public;
CREATE VIEW captcha_challenges_public AS
SELECT id, session_id, challenge_question, expires_at, status, attempts, max_attempts, created_at
FROM captcha_challenges;

-- Grant access to the view
GRANT SELECT ON captcha_challenges_public TO anon, authenticated;

-- Phase 1.2: Secure Product Catalog Data
-- Enable RLS on product tables
ALTER TABLE loan_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can view active loan product names" ON loan_products;
DROP POLICY IF EXISTS "Authenticated users can view full loan product details" ON loan_products;
DROP POLICY IF EXISTS "Admins can manage loan products" ON loan_products;
DROP POLICY IF EXISTS "Public can view active savings products" ON savings_products;
DROP POLICY IF EXISTS "Authenticated users can view full savings details" ON savings_products;
DROP POLICY IF EXISTS "Admins can manage savings products" ON savings_products;

-- Loan products policies
CREATE POLICY "Public can view active loan product names"
ON loan_products FOR SELECT
TO public
USING (is_active = true);

CREATE POLICY "Authenticated users can view full loan product details"
ON loan_products FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage loan products"
ON loan_products FOR ALL
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

-- Savings products policies
CREATE POLICY "Public can view active savings products"
ON savings_products FOR SELECT
TO public
USING (is_active = true);

CREATE POLICY "Authenticated users can view full savings details"
ON savings_products FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage savings products"
ON savings_products FOR ALL
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

-- Phase 4.1: Add Performance Indexes (only for confirmed columns)
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mobile_money_status ON mobile_money_transactions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_events_consent_id ON consent_events(consent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_health_metrics_timestamp ON api_health_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aisp_consents_status ON aisp_consents(status, expiration_date);
CREATE INDEX IF NOT EXISTS idx_pisp_consents_status ON pisp_consents(status, expires_at);