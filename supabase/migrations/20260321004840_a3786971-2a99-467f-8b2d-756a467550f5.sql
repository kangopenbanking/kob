
-- Phase 3: Outbound Remittance Schema

-- Compliance screening table for outbound transfers
CREATE TABLE IF NOT EXISTS public.remittance_compliance_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remittance_id UUID NOT NULL REFERENCES public.remittances(id) ON DELETE CASCADE,
  check_type TEXT NOT NULL DEFAULT 'sanctions_screening',
  status TEXT NOT NULL DEFAULT 'pending',
  risk_score INTEGER DEFAULT 0,
  screening_result JSONB DEFAULT '{}',
  checked_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE public.remittance_compliance_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on compliance checks"
  ON public.remittance_compliance_checks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role access on compliance checks"
  ON public.remittance_compliance_checks
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Corridor limits (per-user, per-corridor daily/monthly caps)
CREATE TABLE IF NOT EXISTS public.remittance_corridor_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corridor_id UUID REFERENCES public.remittance_corridors(id) ON DELETE CASCADE,
  limit_type TEXT NOT NULL DEFAULT 'per_user',
  daily_max_amount NUMERIC DEFAULT 500000,
  monthly_max_amount NUMERIC DEFAULT 5000000,
  per_transaction_max NUMERIC DEFAULT 250000,
  per_transaction_min NUMERIC DEFAULT 1000,
  kyc_tier_required TEXT DEFAULT 'basic',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.remittance_corridor_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on corridor limits"
  ON public.remittance_corridor_limits
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read corridor limits"
  ON public.remittance_corridor_limits
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Service role access on corridor limits"
  ON public.remittance_corridor_limits
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Add outbound-specific columns to remittances
ALTER TABLE public.remittances
  ADD COLUMN IF NOT EXISTS sender_phone TEXT,
  ADD COLUMN IF NOT EXISTS sender_email TEXT,
  ADD COLUMN IF NOT EXISTS sender_id_type TEXT,
  ADD COLUMN IF NOT EXISTS sender_id_number TEXT,
  ADD COLUMN IF NOT EXISTS receiver_email TEXT,
  ADD COLUMN IF NOT EXISTS receiver_country TEXT,
  ADD COLUMN IF NOT EXISTS receiver_bank_name TEXT,
  ADD COLUMN IF NOT EXISTS receiver_bank_code TEXT,
  ADD COLUMN IF NOT EXISTS receiver_account_number TEXT,
  ADD COLUMN IF NOT EXISTS receiver_mobile_wallet TEXT,
  ADD COLUMN IF NOT EXISTS delivery_method TEXT DEFAULT 'bank_transfer',
  ADD COLUMN IF NOT EXISTS compliance_status TEXT DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS compliance_cleared_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Add outbound support to corridors
ALTER TABLE public.remittance_corridors
  ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'inbound',
  ADD COLUMN IF NOT EXISTS delivery_methods JSONB DEFAULT '["bank_transfer", "mobile_wallet"]',
  ADD COLUMN IF NOT EXISTS required_sender_fields JSONB DEFAULT '["name", "phone"]',
  ADD COLUMN IF NOT EXISTS required_receiver_fields JSONB DEFAULT '["name", "account_number"]';

-- Outbound remittance user daily/monthly usage tracking
CREATE TABLE IF NOT EXISTS public.remittance_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  corridor_id UUID REFERENCES public.remittance_corridors(id),
  period_type TEXT NOT NULL,
  period_start DATE NOT NULL,
  total_amount NUMERIC DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'XAF',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, corridor_id, period_type, period_start)
);

ALTER TABLE public.remittance_usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own usage"
  ON public.remittance_usage_tracking
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access usage"
  ON public.remittance_usage_tracking
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
