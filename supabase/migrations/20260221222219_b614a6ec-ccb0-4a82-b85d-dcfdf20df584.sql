
-- =============================================
-- Gateway Feature Parity: 8 New Tables + Alter gateway_charges
-- =============================================

-- 1. Payment Links
CREATE TABLE public.gateway_payment_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  redirect_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  slug TEXT NOT NULL UNIQUE,
  custom_fields JSONB DEFAULT '[]'::jsonb,
  max_uses INTEGER,
  use_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gateway_payment_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants manage own payment links" ON public.gateway_payment_links
  FOR ALL USING (
    merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role full access on payment links" ON public.gateway_payment_links
  FOR ALL USING (auth.role() = 'service_role');

-- Public read for checkout pages (by slug)
CREATE POLICY "Public can read active payment links" ON public.gateway_payment_links
  FOR SELECT USING (status = 'active');

CREATE INDEX idx_gateway_payment_links_merchant ON public.gateway_payment_links(merchant_id);
CREATE INDEX idx_gateway_payment_links_slug ON public.gateway_payment_links(slug);

-- 2. Payment Plans
CREATE TABLE public.gateway_payment_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  interval TEXT NOT NULL DEFAULT 'monthly',
  interval_count INTEGER NOT NULL DEFAULT 1,
  duration INTEGER, -- null = unlimited
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_interval CHECK (interval IN ('daily', 'weekly', 'monthly', 'yearly'))
);

ALTER TABLE public.gateway_payment_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants manage own plans" ON public.gateway_payment_plans
  FOR ALL USING (
    merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role full access on plans" ON public.gateway_payment_plans
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_gateway_payment_plans_merchant ON public.gateway_payment_plans(merchant_id);

-- 3. Subscriptions
CREATE TABLE public.gateway_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.gateway_payment_plans(id) ON DELETE RESTRICT,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  customer_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  next_charge_at TIMESTAMPTZ NOT NULL,
  charges_made INTEGER NOT NULL DEFAULT 0,
  last_charge_id UUID,
  cancel_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_sub_status CHECK (status IN ('active', 'paused', 'cancelled', 'completed'))
);

ALTER TABLE public.gateway_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants manage own subscriptions" ON public.gateway_subscriptions
  FOR ALL USING (
    merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role full access on subscriptions" ON public.gateway_subscriptions
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_gateway_subscriptions_merchant ON public.gateway_subscriptions(merchant_id);
CREATE INDEX idx_gateway_subscriptions_plan ON public.gateway_subscriptions(plan_id);
CREATE INDEX idx_gateway_subscriptions_next_charge ON public.gateway_subscriptions(next_charge_at) WHERE status = 'active';

-- 4. Subaccounts
CREATE TABLE public.gateway_subaccounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  subaccount_name TEXT NOT NULL,
  settlement_bank TEXT,
  account_number TEXT,
  split_type TEXT NOT NULL DEFAULT 'percentage',
  split_value NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_split_type CHECK (split_type IN ('percentage', 'flat'))
);

ALTER TABLE public.gateway_subaccounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants manage own subaccounts" ON public.gateway_subaccounts
  FOR ALL USING (
    merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role full access on subaccounts" ON public.gateway_subaccounts
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_gateway_subaccounts_merchant ON public.gateway_subaccounts(merchant_id);

-- 5. Charge Splits
CREATE TABLE public.gateway_charge_splits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  charge_id UUID NOT NULL REFERENCES public.gateway_charges(id) ON DELETE CASCADE,
  subaccount_id UUID NOT NULL REFERENCES public.gateway_subaccounts(id) ON DELETE RESTRICT,
  split_type TEXT NOT NULL,
  split_value NUMERIC NOT NULL,
  split_amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gateway_charge_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants view own charge splits" ON public.gateway_charge_splits
  FOR SELECT USING (
    charge_id IN (
      SELECT gc.id FROM public.gateway_charges gc
      JOIN public.gateway_merchants gm ON gc.merchant_id = gm.id
      WHERE gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access on charge splits" ON public.gateway_charge_splits
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_gateway_charge_splits_charge ON public.gateway_charge_splits(charge_id);

-- 6. Customers
CREATE TABLE public.gateway_customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  phone TEXT,
  name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, email)
);

ALTER TABLE public.gateway_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants manage own customers" ON public.gateway_customers
  FOR ALL USING (
    merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role full access on customers" ON public.gateway_customers
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_gateway_customers_merchant ON public.gateway_customers(merchant_id);
CREATE INDEX idx_gateway_customers_email ON public.gateway_customers(merchant_id, email);

-- 7. Customer Tokens
CREATE TABLE public.gateway_customer_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.gateway_customers(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  token_ref TEXT NOT NULL,
  channel TEXT NOT NULL,
  last4 TEXT,
  expiry TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gateway_customer_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants view own customer tokens" ON public.gateway_customer_tokens
  FOR SELECT USING (
    customer_id IN (
      SELECT gc.id FROM public.gateway_customers gc
      JOIN public.gateway_merchants gm ON gc.merchant_id = gm.id
      WHERE gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access on customer tokens" ON public.gateway_customer_tokens
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_gateway_customer_tokens_customer ON public.gateway_customer_tokens(customer_id);

-- 8. Charge Events (timeline)
CREATE TABLE public.gateway_charge_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  charge_id UUID NOT NULL REFERENCES public.gateway_charges(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gateway_charge_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants view own charge events" ON public.gateway_charge_events
  FOR SELECT USING (
    charge_id IN (
      SELECT gc.id FROM public.gateway_charges gc
      JOIN public.gateway_merchants gm ON gc.merchant_id = gm.id
      WHERE gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access on charge events" ON public.gateway_charge_events
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_gateway_charge_events_charge ON public.gateway_charge_events(charge_id);
CREATE INDEX idx_gateway_charge_events_type ON public.gateway_charge_events(event_type);

-- =============================================
-- Alter gateway_charges: add new columns
-- =============================================
ALTER TABLE public.gateway_charges
  ADD COLUMN IF NOT EXISTS payment_link_id UUID REFERENCES public.gateway_payment_links(id),
  ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.gateway_subscriptions(id),
  ADD COLUMN IF NOT EXISTS settlement_currency TEXT,
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS settled_amount NUMERIC;

-- Triggers for updated_at
CREATE TRIGGER update_gateway_payment_links_updated_at BEFORE UPDATE ON public.gateway_payment_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gateway_payment_plans_updated_at BEFORE UPDATE ON public.gateway_payment_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gateway_subscriptions_updated_at BEFORE UPDATE ON public.gateway_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gateway_subaccounts_updated_at BEFORE UPDATE ON public.gateway_subaccounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gateway_customers_updated_at BEFORE UPDATE ON public.gateway_customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
