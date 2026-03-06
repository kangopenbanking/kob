
-- ============================================
-- 1. Split Bills
-- ============================================
CREATE TABLE public.split_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  total_amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  split_mode TEXT NOT NULL DEFAULT 'equal',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.split_bill_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  split_bill_id UUID NOT NULL REFERENCES public.split_bills(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  share_amount NUMERIC NOT NULL DEFAULT 0,
  share_percent NUMERIC NOT NULL DEFAULT 0,
  is_owner BOOLEAN NOT NULL DEFAULT false,
  paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.split_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.split_bill_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own split bills" ON public.split_bills
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can manage participants of own split bills" ON public.split_bill_participants
  FOR ALL TO authenticated
  USING (split_bill_id IN (SELECT id FROM public.split_bills WHERE user_id = auth.uid()))
  WITH CHECK (split_bill_id IN (SELECT id FROM public.split_bills WHERE user_id = auth.uid()));

-- ============================================
-- 2. Recurring Payments
-- ============================================
CREATE TABLE public.recurring_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other',
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  frequency TEXT NOT NULL DEFAULT 'Monthly',
  start_date DATE NOT NULL,
  end_date DATE,
  next_payment_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notify BOOLEAN NOT NULL DEFAULT true,
  payments_made INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own recurring payments" ON public.recurring_payments
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================
-- 3. Customer Pay Links
-- ============================================
CREATE TABLE public.customer_pay_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  amount NUMERIC,
  currency TEXT NOT NULL DEFAULT 'XAF',
  is_open_amount BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  clicks INTEGER NOT NULL DEFAULT 0,
  payments_count INTEGER NOT NULL DEFAULT 0,
  total_collected NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_pay_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own pay links" ON public.customer_pay_links
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Timestamp triggers
CREATE OR REPLACE FUNCTION public.update_split_bill_timestamp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_split_bills_updated_at BEFORE UPDATE ON public.split_bills
  FOR EACH ROW EXECUTE FUNCTION public.update_split_bill_timestamp();

CREATE OR REPLACE FUNCTION public.update_recurring_payment_timestamp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_recurring_payments_updated_at BEFORE UPDATE ON public.recurring_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_recurring_payment_timestamp();

CREATE OR REPLACE FUNCTION public.update_customer_pay_link_timestamp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_customer_pay_links_updated_at BEFORE UPDATE ON public.customer_pay_links
  FOR EACH ROW EXECUTE FUNCTION public.update_customer_pay_link_timestamp();
