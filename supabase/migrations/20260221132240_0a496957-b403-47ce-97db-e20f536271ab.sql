
-- =============================================
-- BATCH 1: Gateway Payment Tables
-- =============================================

-- 1. Gateway Merchants
CREATE TABLE public.gateway_merchants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  institution_id UUID REFERENCES public.institutions(id),
  business_name TEXT NOT NULL,
  business_email TEXT,
  business_phone TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  kyb_status TEXT NOT NULL DEFAULT 'not_submitted',
  environment TEXT NOT NULL DEFAULT 'sandbox',
  webhook_url TEXT,
  webhook_secret TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Gateway Charges
CREATE TABLE public.gateway_charges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id),
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT NOT NULL,
  provider_ref TEXT,
  provider_raw JSONB,
  customer_email TEXT,
  customer_phone TEXT,
  customer_name TEXT,
  tx_ref TEXT NOT NULL,
  fee_amount NUMERIC DEFAULT 0,
  net_amount NUMERIC DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  idempotency_key TEXT,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Gateway Payouts
CREATE TABLE public.gateway_payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id),
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT NOT NULL,
  provider_ref TEXT,
  provider_raw JSONB,
  beneficiary_name TEXT,
  beneficiary_account TEXT,
  beneficiary_bank TEXT,
  beneficiary_phone TEXT,
  batch_id UUID,
  narration TEXT,
  fee_amount NUMERIC DEFAULT 0,
  tx_ref TEXT NOT NULL,
  failure_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Gateway Payout Batches
CREATE TABLE public.gateway_payout_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id),
  total_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'XAF',
  status TEXT NOT NULL DEFAULT 'pending',
  item_count INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK from payouts to batches
ALTER TABLE public.gateway_payouts
  ADD CONSTRAINT gateway_payouts_batch_id_fkey
  FOREIGN KEY (batch_id) REFERENCES public.gateway_payout_batches(id);

-- 5. Gateway Refunds
CREATE TABLE public.gateway_refunds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  charge_id UUID NOT NULL REFERENCES public.gateway_charges(id),
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id),
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT,
  provider TEXT NOT NULL,
  provider_ref TEXT,
  provider_raw JSONB,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Gateway Disputes
CREATE TABLE public.gateway_disputes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  charge_id UUID NOT NULL REFERENCES public.gateway_charges(id),
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id),
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  status TEXT NOT NULL DEFAULT 'open',
  reason TEXT,
  evidence_due_by TIMESTAMPTZ,
  evidence_submitted BOOLEAN DEFAULT false,
  evidence_data JSONB,
  provider TEXT NOT NULL,
  provider_ref TEXT,
  provider_raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Gateway Settlements
CREATE TABLE public.gateway_settlements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id),
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  status TEXT NOT NULL DEFAULT 'pending',
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  charges_count INTEGER DEFAULT 0,
  fees_total NUMERIC DEFAULT 0,
  net_amount NUMERIC DEFAULT 0,
  payout_ref TEXT,
  settled_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Gateway Webhook Events (outbound to merchants)
CREATE TABLE public.gateway_webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 7,
  next_retry_at TIMESTAMPTZ,
  last_response_code INTEGER,
  last_response_body TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_gateway_merchants_user_id ON public.gateway_merchants(user_id);
CREATE INDEX idx_gateway_merchants_status ON public.gateway_merchants(status);
CREATE INDEX idx_gateway_charges_merchant_id ON public.gateway_charges(merchant_id);
CREATE INDEX idx_gateway_charges_status ON public.gateway_charges(status);
CREATE INDEX idx_gateway_charges_tx_ref ON public.gateway_charges(tx_ref);
CREATE INDEX idx_gateway_charges_idempotency ON public.gateway_charges(idempotency_key);
CREATE INDEX idx_gateway_charges_created_at ON public.gateway_charges(created_at);
CREATE INDEX idx_gateway_payouts_merchant_id ON public.gateway_payouts(merchant_id);
CREATE INDEX idx_gateway_payouts_batch_id ON public.gateway_payouts(batch_id);
CREATE INDEX idx_gateway_payouts_status ON public.gateway_payouts(status);
CREATE INDEX idx_gateway_refunds_charge_id ON public.gateway_refunds(charge_id);
CREATE INDEX idx_gateway_refunds_merchant_id ON public.gateway_refunds(merchant_id);
CREATE INDEX idx_gateway_disputes_charge_id ON public.gateway_disputes(charge_id);
CREATE INDEX idx_gateway_disputes_merchant_id ON public.gateway_disputes(merchant_id);
CREATE INDEX idx_gateway_settlements_merchant_id ON public.gateway_settlements(merchant_id);
CREATE INDEX idx_gateway_settlements_status ON public.gateway_settlements(status);
CREATE INDEX idx_gateway_webhook_events_merchant_id ON public.gateway_webhook_events(merchant_id);
CREATE INDEX idx_gateway_webhook_events_status ON public.gateway_webhook_events(status);
CREATE INDEX idx_gateway_webhook_events_next_retry ON public.gateway_webhook_events(next_retry_at) WHERE status = 'pending';

-- =============================================
-- TRIGGERS for updated_at
-- =============================================
CREATE TRIGGER update_gateway_merchants_updated_at BEFORE UPDATE ON public.gateway_merchants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gateway_charges_updated_at BEFORE UPDATE ON public.gateway_charges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gateway_payouts_updated_at BEFORE UPDATE ON public.gateway_payouts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gateway_payout_batches_updated_at BEFORE UPDATE ON public.gateway_payout_batches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gateway_refunds_updated_at BEFORE UPDATE ON public.gateway_refunds FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gateway_disputes_updated_at BEFORE UPDATE ON public.gateway_disputes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gateway_settlements_updated_at BEFORE UPDATE ON public.gateway_settlements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- RLS POLICIES
-- =============================================

-- Gateway Merchants
ALTER TABLE public.gateway_merchants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own merchants" ON public.gateway_merchants FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create merchants" ON public.gateway_merchants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own merchants" ON public.gateway_merchants FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role full access merchants" ON public.gateway_merchants FOR ALL USING (auth.role() = 'service_role');

-- Gateway Charges
ALTER TABLE public.gateway_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants can view own charges" ON public.gateway_charges FOR SELECT USING (
  merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Service role full access charges" ON public.gateway_charges FOR ALL USING (auth.role() = 'service_role');

-- Gateway Payouts
ALTER TABLE public.gateway_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants can view own payouts" ON public.gateway_payouts FOR SELECT USING (
  merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Service role full access payouts" ON public.gateway_payouts FOR ALL USING (auth.role() = 'service_role');

-- Gateway Payout Batches
ALTER TABLE public.gateway_payout_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants can view own batches" ON public.gateway_payout_batches FOR SELECT USING (
  merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Service role full access batches" ON public.gateway_payout_batches FOR ALL USING (auth.role() = 'service_role');

-- Gateway Refunds
ALTER TABLE public.gateway_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants can view own refunds" ON public.gateway_refunds FOR SELECT USING (
  merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Service role full access refunds" ON public.gateway_refunds FOR ALL USING (auth.role() = 'service_role');

-- Gateway Disputes
ALTER TABLE public.gateway_disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants can view own disputes" ON public.gateway_disputes FOR SELECT USING (
  merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Service role full access disputes" ON public.gateway_disputes FOR ALL USING (auth.role() = 'service_role');

-- Gateway Settlements
ALTER TABLE public.gateway_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants can view own settlements" ON public.gateway_settlements FOR SELECT USING (
  merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Service role full access settlements" ON public.gateway_settlements FOR ALL USING (auth.role() = 'service_role');

-- Gateway Webhook Events
ALTER TABLE public.gateway_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants can view own webhook events" ON public.gateway_webhook_events FOR SELECT USING (
  merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Service role full access webhook events" ON public.gateway_webhook_events FOR ALL USING (auth.role() = 'service_role');
