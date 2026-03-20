
-- Add dispute lifecycle columns to gateway_disputes
ALTER TABLE gateway_disputes 
  ADD COLUMN IF NOT EXISTS dispute_ref TEXT,
  ADD COLUMN IF NOT EXISTS assignee_id UUID,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'chargeback',
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- Create dispute activity log table
CREATE TABLE IF NOT EXISTS dispute_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL,
  dispute_source TEXT NOT NULL DEFAULT 'gateway',
  actor_id UUID,
  actor_type TEXT DEFAULT 'system',
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  note TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE dispute_activities ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "admin_full_access_dispute_activities" ON dispute_activities
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Merchant access to their gateway disputes activities
CREATE POLICY "merchant_view_own_dispute_activities" ON dispute_activities
  FOR SELECT TO authenticated
  USING (
    dispute_source = 'gateway' AND
    EXISTS (
      SELECT 1 FROM gateway_disputes gd
      JOIN gateway_merchants gm ON gm.id = gd.merchant_id
      WHERE gd.id = dispute_activities.dispute_id AND gm.user_id = auth.uid()
    )
  );

-- Consumer access to their legacy disputes activities
CREATE POLICY "user_view_own_dispute_activities" ON dispute_activities
  FOR SELECT TO authenticated
  USING (
    dispute_source = 'legacy' AND
    EXISTS (
      SELECT 1 FROM disputes d
      WHERE d.id = dispute_activities.dispute_id AND d.user_id = auth.uid()
    )
  );

-- Service role insert for edge functions
CREATE POLICY "service_insert_dispute_activities" ON dispute_activities
  FOR INSERT TO service_role
  WITH CHECK (true);
