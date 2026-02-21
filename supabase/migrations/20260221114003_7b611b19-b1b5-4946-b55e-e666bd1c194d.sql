
-- ==========================================
-- Admin Portal Enhancement: New Tables
-- ==========================================

-- 1. Disputes & Chargebacks table
CREATE TABLE public.disputes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID,
  transaction_ref TEXT,
  institution_id UUID REFERENCES public.institutions(id),
  user_id UUID,
  dispute_type TEXT NOT NULL DEFAULT 'chargeback',
  reason TEXT NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  status TEXT NOT NULL DEFAULT 'open',
  resolution TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  evidence_urls TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage disputes" ON public.disputes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Institutions can view their disputes" ON public.disputes
  FOR SELECT TO authenticated
  USING (institution_id IN (SELECT id FROM public.institutions WHERE user_id = auth.uid()));

CREATE TRIGGER update_disputes_updated_at
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Payouts table
CREATE TABLE public.payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID REFERENCES public.institutions(id) NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  status TEXT NOT NULL DEFAULT 'pending',
  payout_method TEXT NOT NULL DEFAULT 'bank_transfer',
  bank_account_number TEXT,
  bank_code TEXT,
  reference TEXT,
  scheduled_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage payouts" ON public.payouts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Institutions can view their payouts" ON public.payouts
  FOR SELECT TO authenticated
  USING (institution_id IN (SELECT id FROM public.institutions WHERE user_id = auth.uid()));

CREATE TRIGGER update_payouts_updated_at
  BEFORE UPDATE ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Email Templates table
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  variables TEXT[] DEFAULT '{}',
  category TEXT DEFAULT 'transactional',
  is_active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  send_count INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email templates" ON public.email_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default templates
INSERT INTO public.email_templates (template_key, name, subject, body_html, variables, category) VALUES
  ('payment_receipt', 'Payment Receipt', 'Payment Confirmation - {{amount}} {{currency}}', '<h1>Payment Confirmed</h1><p>Amount: {{amount}} {{currency}}</p><p>Reference: {{reference}}</p>', ARRAY['amount', 'currency', 'reference'], 'transactional'),
  ('dispute_opened', 'Dispute Opened', 'Dispute #{{dispute_id}} - Action Required', '<h1>Dispute Notification</h1><p>A dispute has been opened for transaction {{transaction_ref}}</p>', ARRAY['dispute_id', 'transaction_ref', 'amount'], 'transactional'),
  ('payout_completed', 'Payout Completed', 'Payout of {{amount}} {{currency}} Processed', '<h1>Payout Completed</h1><p>Your payout of {{amount}} {{currency}} has been processed.</p>', ARRAY['amount', 'currency', 'reference'], 'transactional'),
  ('kyc_approved', 'KYC Approved', 'Your KYC Verification is Complete', '<h1>KYC Approved</h1><p>Your identity verification has been approved.</p>', ARRAY['user_name'], 'notification'),
  ('welcome', 'Welcome Email', 'Welcome to KOB - {{user_name}}', '<h1>Welcome to Kang Open Banking</h1><p>Hello {{user_name}}, your account is ready.</p>', ARRAY['user_name'], 'notification');

-- 4. Admin Exchange Rates table
CREATE TABLE public.admin_exchange_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  base_currency TEXT NOT NULL,
  target_currency TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  margin_percentage NUMERIC DEFAULT 0,
  effective_rate NUMERIC GENERATED ALWAYS AS (rate * (1 + margin_percentage / 100)) STORED,
  source TEXT DEFAULT 'manual',
  is_active BOOLEAN DEFAULT true,
  effective_from TIMESTAMPTZ DEFAULT now(),
  effective_until TIMESTAMPTZ,
  set_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(base_currency, target_currency, effective_from)
);

ALTER TABLE public.admin_exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage exchange rates" ON public.admin_exchange_rates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view active rates" ON public.admin_exchange_rates
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE TRIGGER update_admin_exchange_rates_updated_at
  BEFORE UPDATE ON public.admin_exchange_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Fraud Rules table
CREATE TABLE public.fraud_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL DEFAULT 'threshold',
  description TEXT,
  conditions JSONB NOT NULL DEFAULT '{}',
  severity TEXT NOT NULL DEFAULT 'medium',
  action TEXT NOT NULL DEFAULT 'flag',
  is_active BOOLEAN DEFAULT true,
  trigger_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fraud_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage fraud rules" ON public.fraud_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_fraud_rules_updated_at
  BEFORE UPDATE ON public.fraud_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default fraud rules
INSERT INTO public.fraud_rules (rule_name, rule_type, description, conditions, severity, action) VALUES
  ('High Value Transaction', 'threshold', 'Flag transactions above 5,000,000 XAF', '{"field": "amount", "operator": ">", "value": 5000000}', 'high', 'flag'),
  ('Rapid Transactions', 'velocity', 'More than 10 transactions in 1 hour from same user', '{"count": 10, "window_minutes": 60}', 'medium', 'flag'),
  ('Cross-Border Transfer', 'geo', 'International transfers require review', '{"type": "cross_border"}', 'medium', 'review'),
  ('New Account Large Transfer', 'composite', 'Large transfer from account less than 7 days old', '{"account_age_days": 7, "amount_threshold": 1000000}', 'critical', 'block');

-- 6. Admin Portal Permissions table (RBAC for admin sub-roles)
CREATE TABLE public.admin_portal_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  section_key TEXT NOT NULL,
  can_view BOOLEAN DEFAULT true,
  can_manage BOOLEAN DEFAULT false,
  granted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, section_key)
);

ALTER TABLE public.admin_portal_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage admin permissions" ON public.admin_portal_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_admin_portal_permissions_updated_at
  BEFORE UPDATE ON public.admin_portal_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper function to get admin portal sections
CREATE OR REPLACE FUNCTION public.get_admin_portal_sections(_user_id UUID)
RETURNS TABLE(section_key TEXT, can_view BOOLEAN, can_manage BOOLEAN)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT app.section_key, app.can_view, app.can_manage
  FROM public.admin_portal_permissions app
  WHERE app.user_id = _user_id
$$;
