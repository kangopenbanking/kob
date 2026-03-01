
-- Phase 1: linked_account_change_requests table
CREATE TABLE public.linked_account_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL DEFAULT 'add_after_removal',
  requested_account_data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE linked_account_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own requests" ON linked_account_change_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users create own requests" ON linked_account_change_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins manage all requests" ON linked_account_change_requests
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Add removal tracking to customer_linked_accounts
ALTER TABLE customer_linked_accounts
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS removal_count INTEGER DEFAULT 0;
